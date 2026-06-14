import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "../plugins/supabase.js";
import { env } from "../env.js";

const anthropic = new Anthropic({ apiKey: env.CLAUDE_API_KEY });

export interface Insight {
  tipo: "positivo" | "alerta" | "neutro";
  texto: string;
}

export async function gerarInsights(userId: string): Promise<Insight[]> {
  const hoje = new Date();
  const mesAtualInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const mesAtualFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];

  const mesAnteriorInicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
    .toISOString()
    .split("T")[0];
  const mesAnteriorFim = new Date(hoje.getFullYear(), hoje.getMonth(), 0)
    .toISOString()
    .split("T")[0];

  const tresM = new Date();
  tresM.setMonth(tresM.getMonth() - 3);

  const { data: txAtual } = await supabaseAdmin
    .from("transactions")
    .select("valor, categoria")
    .eq("user_id", userId)
    .gte("data", mesAtualInicio)
    .lte("data", mesAtualFim);

  const { data: txAnterior } = await supabaseAdmin
    .from("transactions")
    .select("valor, categoria")
    .eq("user_id", userId)
    .gte("data", mesAnteriorInicio)
    .lte("data", mesAnteriorFim);

  const { data: tx3Meses } = await supabaseAdmin
    .from("transactions")
    .select("valor, categoria, data")
    .eq("user_id", userId)
    .gte("data", tresM.toISOString().split("T")[0]);

  if (!txAtual || txAtual.length === 0) return [];

  // Gastos por categoria: mês atual vs média 3 meses
  const gastosPorCategoriaAtual: Record<string, number> = {};
  txAtual
    .filter((t) => Number(t.valor) < 0)
    .forEach((t) => {
      const cat = t.categoria || "Outros";
      gastosPorCategoriaAtual[cat] =
        (gastosPorCategoriaAtual[cat] || 0) + Math.abs(Number(t.valor));
    });

  const gastosPorCategoria3M: Record<string, number> = {};
  (tx3Meses || [])
    .filter((t) => Number(t.valor) < 0)
    .forEach((t) => {
      const cat = t.categoria || "Outros";
      gastosPorCategoria3M[cat] =
        (gastosPorCategoria3M[cat] || 0) + Math.abs(Number(t.valor));
    });

  const comparativoCategorias = Object.entries(gastosPorCategoriaAtual)
    .map(([cat, atual]) => {
      const media3M = (gastosPorCategoria3M[cat] || 0) / 3;
      const variacao = media3M > 0 ? ((atual - media3M) / media3M) * 100 : 0;
      return { categoria: cat, atual, media3M, variacao };
    })
    .sort((a, b) => Math.abs(b.variacao) - Math.abs(a.variacao));

  const totalGastosAtual = txAtual
    .filter((t) => Number(t.valor) < 0)
    .reduce((s, t) => s + Math.abs(Number(t.valor)), 0);
  const totalGastosAnterior = (txAnterior || [])
    .filter((t) => Number(t.valor) < 0)
    .reduce((s, t) => s + Math.abs(Number(t.valor)), 0);
  const economia = totalGastosAnterior - totalGastosAtual;

  const investAtual = txAtual
    .filter((t) => t.categoria === "Investimentos" && Number(t.valor) < 0)
    .reduce((s, t) => s + Math.abs(Number(t.valor)), 0);
  const investAnterior = (txAnterior || [])
    .filter((t) => t.categoria === "Investimentos" && Number(t.valor) < 0)
    .reduce((s, t) => s + Math.abs(Number(t.valor)), 0);
  const variacaoInvest =
    investAnterior > 0 ? ((investAtual - investAnterior) / investAnterior) * 100 : null;

  const { data: previsoes } = await supabaseAdmin
    .from("forecasts")
    .select("data_prevista, saldo_projetado")
    .eq("user_id", userId)
    .gte("data_prevista", hoje.toISOString().split("T")[0])
    .order("data_prevista", { ascending: true })
    .limit(30);

  const diaSaldoNegativo = (previsoes || []).find((p) => Number(p.saldo_projetado) < 0);
  let diasParaNegativo: number | null = null;
  if (diaSaldoNegativo) {
    diasParaNegativo = Math.ceil(
      (new Date(diaSaldoNegativo.data_prevista).getTime() - hoje.getTime()) /
        (1000 * 60 * 60 * 24)
    );
  }

  const prompt = `Você é um consultor financeiro do Renda Viva. Analise os dados abaixo e gere
exatamente 3 a 4 insights curtos, diretos e acionáveis em português brasileiro.
Retorne SOMENTE um JSON array, sem texto adicional.

DADOS:
- Total de gastos este mês: R$ ${totalGastosAtual.toFixed(2)}
- Total de gastos mês anterior: R$ ${totalGastosAnterior.toFixed(2)}
- Economia em relação ao mês anterior: R$ ${economia.toFixed(2)}

TOP 3 CATEGORIAS COM MAIOR VARIAÇÃO (atual vs média 3 meses):
${comparativoCategorias
    .slice(0, 3)
    .map(
      (c) =>
        `- ${c.categoria}: R$ ${c.atual.toFixed(2)} (média: R$ ${c.media3M.toFixed(2)}, variação: ${c.variacao.toFixed(1)}%)`
    )
    .join("\n")}

INVESTIMENTOS:
- Este mês: R$ ${investAtual.toFixed(2)}
- Mês anterior: R$ ${investAnterior.toFixed(2)}
${variacaoInvest !== null ? `- Variação: ${variacaoInvest.toFixed(1)}%` : ""}

PREVISÃO DE SALDO:
${
    diasParaNegativo !== null
      ? `- Saldo pode ficar negativo em aproximadamente ${diasParaNegativo} dias`
      : "- Saldo projetado permanece positivo nos próximos 30 dias"
  }

Retorne JSON no formato:
[
  { "tipo": "positivo" | "alerta" | "neutro", "texto": "frase curta com dados reais" }
]

Regras:
- "alerta" para riscos (saldo negativo, gastos muito acima da média)
- "positivo" para boas notícias (economia, investimentos aumentando, gastos controlados)
- "neutro" para informações relevantes sem julgamento
- Sempre use valores reais nas frases
- Frases devem ter no máximo 100 caracteres
- Priorize o que é mais relevante/urgente primeiro`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const first = response.content[0];
    const responseText = first && first.type === "text" ? first.text : "[]";
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
