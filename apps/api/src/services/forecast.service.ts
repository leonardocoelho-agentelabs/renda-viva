import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "../plugins/supabase.js";
import { env } from "../env.js";

const anthropic = new Anthropic({ apiKey: env.CLAUDE_API_KEY });

interface PrevisaoIA {
  data?: string;
  saldo_projetado?: number;
  confianca?: number;
  evento?: string;
}

export async function gerarPrevisaoSaldo(userId: string): Promise<number> {
  // 1. Histórico de 3 meses
  const tresM = new Date();
  tresM.setMonth(tresM.getMonth() - 3);

  const { data: historico } = await supabaseAdmin
    .from("transactions")
    .select("data, valor, categoria, descricao_raw, is_recorrente")
    .eq("user_id", userId)
    .gte("data", tresM.toISOString().split("T")[0])
    .order("data", { ascending: true });

  if (!historico || historico.length < 5) return 0;

  // 2. Padrões
  const saldoAtual = historico.reduce((s, t) => s + Number(t.valor), 0);

  const receitasRecorrentes =
    historico
      .filter((t) => Number(t.valor) > 0 && t.is_recorrente)
      .reduce((s, t) => s + Number(t.valor), 0) / 3;

  const despesasRecorrentes =
    historico
      .filter((t) => Number(t.valor) < 0 && t.is_recorrente)
      .reduce((s, t) => s + Math.abs(Number(t.valor)), 0) / 3;

  const gastosPorSemana = [0, 0, 0, 0];
  historico
    .filter((t) => Number(t.valor) < 0 && !t.is_recorrente)
    .forEach((t) => {
      const dia = new Date(t.data).getDate();
      const semana = Math.min(Math.floor((dia - 1) / 7), 3);
      gastosPorSemana[semana] += Math.abs(Number(t.valor)) / 3;
    });

  const hoje = new Date().toISOString().split("T")[0];

  const prompt = `Você é um analista financeiro. Gere uma previsão de saldo para os próximos 30 dias.
Retorne SOMENTE JSON válido com array de 30 objetos.

DADOS FINANCEIROS DO USUÁRIO:
- Saldo atual: R$ ${saldoAtual.toFixed(2)}
- Receitas recorrentes mensais: R$ ${receitasRecorrentes.toFixed(2)}
- Despesas fixas mensais: R$ ${despesasRecorrentes.toFixed(2)}
- Gastos variáveis por semana (média):
  Semana 1: R$ ${gastosPorSemana[0].toFixed(2)}
  Semana 2: R$ ${gastosPorSemana[1].toFixed(2)}
  Semana 3: R$ ${gastosPorSemana[2].toFixed(2)}
  Semana 4: R$ ${gastosPorSemana[3].toFixed(2)}

Data de início: ${hoje}

Retorne array com 30 objetos, um por dia:
[
  {
    "data": "2026-06-14",
    "saldo_projetado": 1250.00,
    "confianca": 0.90,
    "evento": "Despesas fixas do início do mês"
  }
]

Regras:
- Saldo começa do valor atual e vai acumulando dia a dia
- Distribua receitas e despesas recorrentes nos dias mais prováveis
- Semana 1 (dias 1-7): adicionar receitas recorrentes, subtrair despesas fixas
- Use confiança maior (0.85-0.95) para dias próximos, menor (0.60-0.75) para dias distantes
- Campo "evento" é opcional, só quando há algo relevante naquele dia`;

  let previsoes: PrevisaoIA[] = [];
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });
    const first = response.content[0];
    const responseText = first && first.type === "text" ? first.text : "[]";
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return 0;
    const parsed = JSON.parse(jsonMatch[0]);
    if (Array.isArray(parsed)) previsoes = parsed;
  } catch {
    return 0;
  }

  // Validar/normalizar e remover duplicatas por data (constraint unique)
  const vistas = new Set<string>();
  const registros = previsoes
    .filter(
      (p) =>
        p &&
        typeof p.data === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(p.data) &&
        typeof p.saldo_projetado === "number"
    )
    .filter((p) => {
      if (vistas.has(p.data!)) return false;
      vistas.add(p.data!);
      return true;
    })
    .map((p) => ({
      user_id: userId,
      data_prevista: p.data!,
      saldo_projetado: p.saldo_projetado!,
      // Clamp para respeitar o CHECK (confianca entre 0 e 1)
      confianca:
        typeof p.confianca === "number"
          ? Math.max(0, Math.min(1, p.confianca))
          : 0.5,
      gerado_em: new Date().toISOString(),
    }));

  if (registros.length === 0) return 0;

  // Substituir previsões futuras: apaga as antigas e insere as novas
  await supabaseAdmin
    .from("forecasts")
    .delete()
    .eq("user_id", userId)
    .gte("data_prevista", hoje);

  const { error } = await supabaseAdmin.from("forecasts").insert(registros);
  if (error) {
    throw new Error(`Erro ao salvar previsões: ${error.message}`);
  }

  return registros.length;
}
