import { supabaseAdmin } from "../plugins/supabase.js";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "../env.js";

const anthropic = new Anthropic({ apiKey: env.CLAUDE_API_KEY });

export interface DiagnosticoPerfil {
  tipo: string;
  descricao: string;
}

export interface PlanoMelhoria {
  acao: string;
  impacto: "alto" | "medio" | "baixo";
  prazo: "imediato" | "30dias" | "90dias";
}

export interface FinancialDiagnostic {
  id: string;
  user_id: string;
  perfil_tipo: string | null;
  perfil_descricao: string | null;
  pontos_fortes: string[];
  pontos_fracos: string[];
  riscos: string[];
  oportunidades: string[];
  plano_melhoria: PlanoMelhoria[];
  frase_diagnostico: string | null;
  score_momento: number | null;
  created_at: string;
}

// Extrai JSON robustamente da resposta do Claude
function extractJson<T>(text: string): T | null {
  const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    try {
      return JSON.parse(jsonBlockMatch[1].trim());
    } catch {
      // continua
    }
  }
  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0]);
    } catch {
      // continua
    }
  }
  return null;
}

// Tipos de perfil possíveis
const TIPOS_PERFIL = [
  "Planejador Estratégico",
  "Acumulador Inteligente",
  "Gastador Impulsivo",
  "Investidor Consistente",
  "Construtor de Patrimônio",
  "Conservador Excessivo",
];

/**
 * Busca o diagnóstico mais recente do usuário
 */
export async function buscarDiagnosticoRecente(
  userId: string
): Promise<FinancialDiagnostic | null> {
  const { data, error } = await supabaseAdmin
    .from("financial_diagnostics")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  return data || null;
}

/**
 * Gera um novo diagnóstico financeiro completo
 */
export async function gerarDiagnostico(userId: string): Promise<FinancialDiagnostic> {
  // 1. Buscar dados completos do usuário
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("score_saude, renda_mensal, full_name")
    .eq("id", userId)
    .single();

  const score = user?.score_saude || 0;
  const renda = user?.renda_mensal || 0;

  // 2. Buscar transações dos últimos 6 meses
  const seisMesesAtras = new Date();
  seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6);

  const { data: transacoes } = await supabaseAdmin
    .from("transactions")
    .select("valor, categoria, descricao_raw, data")
    .eq("user_id", userId)
    .gte("data", seisMesesAtras.toISOString().split("T")[0]);

  // 3. Calcular estatísticas
  const seisMeses = 6;
  const gastosPorMes: number[] = [];
  const topCategorias: Record<string, number> = {};
  let totalGastos = 0;
  let totalReceitas = 0;

  // Agrupar por mês
  for (let i = 0; i < seisMeses; i++) {
    const mes = new Date();
    mes.setMonth(mes.getMonth() - i);
    const mesStr = mes.toISOString().substring(0, 7);
    const gastoMes =
      transacoes
        ?.filter((t) => t.data.startsWith(mesStr) && Number(t.valor) < 0)
        .reduce((sum, t) => sum + Math.abs(Number(t.valor)), 0) || 0;
    gastosPorMes.push(gastoMes);
  }

  const mediaMensal = gastosPorMes.reduce((a, b) => a + b, 0) / seisMeses;

  // Top categorias (últimos 3 meses)
  const tresMesesAtras = new Date();
  tresMesesAtras.setMonth(tresMesesAtras.getMonth() - 3);

  const transacoesRecentes = transacoes?.filter(
    (t) => t.data >= tresMesesAtras.toISOString().split("T")[0]
  );

  transacoesRecentes?.forEach((t) => {
    if (Number(t.valor) < 0) {
      const cat = t.categoria || "Outros";
      topCategorias[cat] = (topCategorias[cat] || 0) + Math.abs(Number(t.valor));
    }
  });

  const topCategoriasList = Object.entries(topCategorias)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat]) => cat);

  totalGastos =
    transacoes
      ?.filter((t) => Number(t.valor) < 0)
      .reduce((sum, t) => sum + Math.abs(Number(t.valor)), 0) || 0;

  totalReceitas =
    transacoes
      ?.filter((t) => Number(t.valor) > 0)
      .reduce((sum, t) => sum + Number(t.valor), 0) || 0;

  // 4. Buscar metas ativas
  const { data: metas } = await supabaseAdmin
    .from("goals")
    .select("nome, status")
    .eq("user_id", userId)
    .eq("status", "ativa");

  // 5. Montar prompt para Claude Sonnet
  const prompt = `
Você é um consultor financeiro especialista. Analise os dados financeiros abaixo e gere um diagnóstico completo do perfil.

DADOS DO USUÁRIO:
- Score de saúde: ${score}/100
- Renda mensal declarada: R$ ${renda.toLocaleString("pt-BR")}
- Gastos médios mensais: R$ ${mediaMensal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
- Top categorias de gasto: ${topCategoriasList.join(", ") || "N/A"}
- Total gastos 6 meses: R$ ${totalGastos.toLocaleString("pt-BR")}
- Total receitas 6 meses: R$ ${totalReceitas.toLocaleString("pt-BR")}
- Metas ativas: ${metas?.map((m) => m.nome).join(", ") || "Nenhuma"}

Retorne SOMENTE um JSON válido com esta estrutura:
{
  "perfil": {
    "tipo": "Planejador Estratégico|Acumulador Inteligente|Gastador Impulsivo|Investidor Consistente|Construtor de Patrimônio|Conservador Excessivo",
    "descricao": "descrição do perfil em 2 frases"
  },
  "pontos_fortes": ["item 1", "item 2", "item 3"],
  "pontos_fracos": ["item 1", "item 2", "item 3"],
  "riscos": ["risco 1", "risco 2"],
  "oportunidades": ["oportunidade 1", "oportunidade 2"],
  "plano_melhoria": [
    {
      "acao": "descrição da ação",
      "impacto": "alto|medio|baixo",
      "prazo": "imediato|30dias|90dias"
    }
  ],
  "frase_diagnostico": "Uma frase marcante sobre o perfil financeiro (para compartilhar)"
}

Escolha o tipo de perfil que melhor se encaixa no comportamento financeiro descrito.
`.trim();

  // 6. Chamar IA
  let diagnosticoData: Record<string, unknown> = {};

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const first = response.content[0];
    if (first && first.type === "text") {
      diagnosticoData = extractJson<Record<string, unknown>>(first.text) || {};
    }
  } catch (aiErr) {
    console.error("[Diagnóstico] Erro ao gerar com IA:", aiErr);
  }

  // 7. Garantir que perfil_tipo seja válido
  const perfilTipo = diagnosticoData.perfil as { tipo?: string; descricao?: string } | undefined;
  if (perfilTipo && !TIPOS_PERFIL.includes(perfilTipo.tipo || "")) {
    perfilTipo.tipo = TIPOS_PERFIL[0]; // Fallback
  }

  // 8. Salvar diagnóstico
  const { data: diagnostico, error } = await supabaseAdmin
    .from("financial_diagnostics")
    .insert({
      user_id: userId,
      perfil_tipo: perfilTipo?.tipo || "Planejador Estratégico",
      perfil_descricao: perfilTipo?.descricao || "",
      pontos_fortes: diagnosticoData.pontos_fortes || [],
      pontos_fracos: diagnosticoData.pontos_fracos || [],
      riscos: diagnosticoData.riscos || [],
      oportunidades: diagnosticoData.oportunidades || [],
      plano_melhoria: diagnosticoData.plano_melhoria || [],
      frase_diagnostico: diagnosticoData.frase_diagnostico || "",
      score_momento: score,
      dados_analisados: {
        renda_mensal: renda,
        media_gastos: mediaMensal,
        top_categorias: topCategoriasList,
        total_gastos: totalGastos,
        total_receitas: totalReceitas,
        metas_ativas: metas?.length || 0,
      },
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return diagnostico as FinancialDiagnostic;
}
