import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { anthropic } from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";

// Tipos
interface SimulationResult {
  tipo: string;
  parametros: {
    valor: number;
    parcelas: number;
    valor_parcela: number;
    taxa_juros_mensal: number;
    economia_mensal: number;
  };
  impacto_1_ano: {
    saldo_acumulado: number;
    total_pago: number;
    percentual_renda_comprometido: number;
    meses_para_quitar: number;
    resumo: string;
  };
  impacto_2_anos: {
    saldo_acumulado: number;
    total_pago: number;
    percentual_renda_comprometido: number;
    resumo: string;
  };
  impacto_5_anos: {
    saldo_acumulado: number;
    total_pago: number;
    custo_oportunidade: number;
    resumo: string;
  };
  viabilidade: "viavel" | "atencao" | "critico";
  resumo_geral: string;
  recomendacao: string;
  alternativas: string[];
  alertas: string[];
}

interface SimulateBody {
  pergunta: string;
}

// Buscar contexto financeiro do usuário
async function getUserFinancialContext(supabase: SupabaseClient, userId: string) {
  // Buscar dados do usuário
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("renda_mensal")
    .eq("id", userId)
    .single();

  if (userError) {
    console.error("Erro ao buscar usuário:", userError);
  }

  // Buscar transações dos últimos 3 meses para calcular média de gastos
  const tresMesesAtras = new Date();
  tresMesesAtras.setMonth(tresMesesAtras.getMonth() - 3);

  const { data: transactions, error: txError } = await supabase
    .from("transactions")
    .select("amount, type, date")
    .eq("user_id", userId)
    .gte("date", tresMesesAtras.toISOString())
    .eq("status", "completed");

  if (txError) {
    console.error("Erro ao buscar transações:", txError);
  }

  // Calcular gastos médios mensais
  const gastosPorMes: Record<string, number> = {};
  let totalGasto = 0;

  if (transactions) {
    transactions.forEach((tx) => {
      if (tx.type === "expense") {
        const mes = tx.date.substring(0, 7); // YYYY-MM
        gastosPorMes[mes] = (gastosPorMes[mes] || 0) + Math.abs(tx.amount);
        totalGasto += Math.abs(tx.amount);
      }
    });
  }

  const mesesComTransacao = Object.keys(gastosPorMes).length || 1;
  const mediaMensal = totalGasto / mesesComTransacao;

  // Buscar score de saúde
  const { data: scoreData, error: scoreError } = await supabase
    .from("financial_scores")
    .select("total_score")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const score = scoreData?.total_score || 50;

  // Buscar metas ativas
  const { data: metas, error: metasError } = await supabase
    .from("goals")
    .select("name, target_amount, current_amount")
    .eq("user_id", userId)
    .eq("status", "active");

  const metasAtivas = metas
    ? metas.map(m => `${m.name} (R$${m.current_amount?.toFixed(2) || 0} de R$${m.target_amount?.toFixed(2)})`).join(", ")
    : "Nenhuma meta ativa";

  // Buscar compromissos recorrentes
  const { data: compromissos, error: compError } = await supabase
    .from("recurring")
    .select("amount, type")
    .eq("user_id", userId)
    .eq("status", "active");

  let compromissosMensais = 0;
  if (compromissos) {
    compromissos.forEach((c) => {
      if (c.type === "expense") {
        compromissosMensais += Math.abs(c.amount);
      }
    });
  }

  // Calcular saldo médio
  const saldoMedio = (user?.renda_mensal || 0) - mediaMensal;

  return {
    renda: user?.renda_mensal,
    mediaMensal: mediaMensal.toFixed(2),
    compromissosMensais: compromissosMensais.toFixed(2),
    saldoMedio: saldoMedio.toFixed(2),
    score,
    metas: metasAtivas,
  };
}

// Tipo do contexto financeiro
type FinancialContext = Awaited<ReturnType<typeof getUserFinancialContext>>;

// Montar prompt para Claude
function buildPrompt(pergunta: string, contexto: FinancialContext): string {
  return `Você é um simulador financeiro especialista em finanças pessoais brasileiras.
Analise o cenário descrito e projete o impacto financeiro real.

CONTEXTO FINANCEIRO DO USUÁRIO:
- Renda mensal: R$${contexto.renda || 'não informada'}
- Gastos médios mensais: R$${contexto.mediaMensal}
- Compromissos fixos mensais: R$${contexto.compromissosMensais}
- Saldo médio mensal: R$${contexto.saldoMedio}
- Score de saúde financeira: ${contexto.score}/100
- Metas ativas: ${contexto.metas}

CENÁRIO SOLICITADO:
"${pergunta}"

Analise este cenário e retorne SOMENTE um JSON válido (sem markdown, sem texto adicional):
{
  "tipo": "financiamento|investimento|cancelamento|compra|mudanca_renda|outro",
  "parametros": {
    "valor": 0,
    "parcelas": 0,
    "valor_parcela": 0,
    "taxa_juros_mensal": 0,
    "economia_mensal": 0
  },
  "impacto_1_ano": {
    "saldo_acumulado": 0,
    "total_pago": 0,
    "percentual_renda_comprometido": 0,
    "meses_para_quitar": 0,
    "resumo": "texto explicativo em 1 frase"
  },
  "impacto_2_anos": {
    "saldo_acumulado": 0,
    "total_pago": 0,
    "percentual_renda_comprometido": 0,
    "resumo": "texto explicativo em 1 frase"
  },
  "impacto_5_anos": {
    "saldo_acumulado": 0,
    "total_pago": 0,
    "custo_oportunidade": 0,
    "resumo": "texto explicativo em 1 frase"
  },
  "viabilidade": "viavel|atencao|critico",
  "resumo_geral": "análise completa em 2-3 frases diretas",
  "recomendacao": "recomendação específica e acionável em 1-2 frases",
  "alternativas": [
    "alternativa 1 concreta",
    "alternativa 2 concreta"
  ],
  "alertas": [
    "alerta importante se houver"
  ]
}

Use os dados reais do usuário para tornar a projeção precisa.
Considere inflação de 4.5% ao ano e CDI de 10.5% ao ano para calcular custo de oportunidade.
Se a renda não foi informada, faça projeções relativas (percentuais).
Retorne apenas o JSON, sem nenhum texto antes ou depois.`;
}

// Chamar Claude Sonnet para análise
async function callClaudeSonnet(prompt: string): Promise<SimulationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY não configurada");
  }

  const client = new anthropic({
    apiKey,
  });

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const responseText = message.content[0].type === "text"
    ? message.content[0].text
    : "";

  // Parsear JSON da resposta
  // Limpar markdown se houver
  let cleanJson = responseText.trim();
  if (cleanJson.startsWith("```json")) {
    cleanJson = cleanJson.slice(7);
  }
  if (cleanJson.startsWith("```")) {
    cleanJson = cleanJson.slice(3);
  }
  if (cleanJson.endsWith("```")) {
    cleanJson = cleanJson.slice(0, -3);
  }
  cleanJson = cleanJson.trim();

  try {
    return JSON.parse(cleanJson) as SimulationResult;
  } catch (error) {
    console.error("Erro ao parsear JSON:", error);
    console.error("Resposta bruta:", responseText);
    throw new Error("Resposta inválida da IA");
  }
}

// Registrar rotas
export async function simulatorRoutes(app: FastifyInstance) {
  // POST /api/simulator/simulate
  app.post<{ Body: SimulateBody }>(
    "/simulate",
    { preHandler: [app.authenticate] },
    async (request: FastifyRequest<{ Body: SimulateBody }>, reply: FastifyReply) => {
      try {
        const supabase = app.supabase;
        const userId = request.user?.id;
        if (!userId) {
          return reply.status(401).send({ success: false, error: "Não autorizado" });
        }

        const { pergunta } = request.body;
        if (!pergunta?.trim()) {
          return reply.status(400).send({ success: false, error: "Pergunta é obrigatória" });
        }

        // Buscar contexto financeiro
        const contexto = await getUserFinancialContext(supabase, userId);

        // Montar prompt e chamar IA
        const prompt = buildPrompt(pergunta, contexto);
        const resultado = await callClaudeSonnet(prompt);

        // Salvar simulação
        const { data: simulation, error: saveError } = await supabase
          .from("simulations")
          .insert({
            user_id: userId,
            pergunta_original: pergunta,
            tipo: resultado.tipo,
            valor: resultado.parametros.valor,
            parcelas: resultado.parametros.parcelas,
            taxa_juros: resultado.parametros.taxa_juros_mensal,
            impacto_1_ano: resultado.impacto_1_ano,
            impacto_2_anos: resultado.impacto_2_anos,
            impacto_5_anos: resultado.impacto_5_anos,
            resumo: resultado.resumo_geral,
            recomendacao: resultado.recomendacao,
            viabilidade: resultado.viabilidade,
            alternativas: resultado.alternativas,
            alertas: resultado.alertas,
          })
          .select()
          .single();

        if (saveError) {
          console.error("Erro ao salvar simulação:", saveError);
          // Não falhar por causa do erro de salvar
        }

        return reply.send({
          success: true,
          simulation: {
            id: simulation?.id,
            pergunta_original: pergunta,
            tipo: resultado.tipo,
            parametros: resultado.parametros,
            impacto_1_ano: resultado.impacto_1_ano,
            impacto_2_anos: resultado.impacto_2_anos,
            impacto_5_anos: resultado.impacto_5_anos,
            viabilidade: resultado.viabilidade,
            resumo_geral: resultado.resumo_geral,
            recomendacao: resultado.recomendacao,
            alternativas: resultado.alternativas,
            alertas: resultado.alertas,
            created_at: simulation?.created_at || new Date().toISOString(),
          },
        });
      } catch (error) {
        console.error("Erro na simulação:", error);
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : "Erro interno",
        });
      }
    }
  );

  // GET /api/simulator/history
  app.get(
    "/history",
    { preHandler: [app.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const supabase = app.supabase;
        const userId = request.user?.id;
        if (!userId) {
          return reply.status(401).send({ success: false, error: "Não autorizado" });
        }

        const { data: simulations, error } = await supabase
          .from("simulations")
          .select("id, pergunta_original, tipo, viabilidade, resumo, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(10);

        if (error) {
          console.error("Erro ao buscar histórico:", error);
          return reply.status(500).send({ success: false, error: "Erro ao buscar histórico" });
        }

        return reply.send({
          success: true,
          simulations: simulations || [],
        });
      } catch (error) {
        console.error("Erro ao buscar histórico:", error);
        return reply.status(500).send({
          success: false,
          error: "Erro interno",
        });
      }
    }
  );

  // GET /api/simulator/:id
  app.get<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [app.authenticate] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const supabase = app.supabase;
        const userId = request.user?.id;
        if (!userId) {
          return reply.status(401).send({ success: false, error: "Não autorizado" });
        }

        const { id } = request.params;

        const { data: simulation, error } = await supabase
          .from("simulations")
          .select("*")
          .eq("id", id)
          .eq("user_id", userId)
          .single();

        if (error || !simulation) {
          return reply.status(404).send({ success: false, error: "Simulação não encontrada" });
        }

        return reply.send({
          success: true,
          simulation,
        });
      } catch (error) {
        console.error("Erro ao buscar simulação:", error);
        return reply.status(500).send({
          success: false,
          error: "Erro interno",
        });
      }
    }
  );
}
