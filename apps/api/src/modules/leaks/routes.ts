import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { authHook } from "../../plugins/auth.js";

interface LeakGrupo {
  nome_normalizado: string;
  descricao_raw_principal: string;
  total_gasto: number;
  quantidade_vezes: number;
  media_por_vez: number;
  primeira_ocorrencia: string;
  ultima_ocorrencia: string;
  estabelecimento?: string;
  categoria?: string;
}

interface Vazamento {
  nome: string;
  categoria: string;
  total_periodo: number;
  quantidade_vezes: number;
  media_por_ocorrencia: number;
  frequencia: string;
  tipo: string;
  descricao_raw_principal: string;
  nivel_alerta: string;
  sugestao: string;
  economia_anual_potencial: number;
}

interface AnalysisResult {
  vazamentos: Vazamento[];
  total_vazamentos: number;
  economia_anual_total: number;
  categoria_mais_vazamentos: string;
  insight_principal: string;
  periodo: number;
  data_analise: string;
}

// Função para normalizar descrição (agrupar similares)
function normalizarDescricao(descricao: string): string {
  return descricao
    .toLowerCase()
    .replace(/[0-9]+/g, "") // remover números
    .replace(/[^a-záàâãéèêíïóôõöúüç\s]/gi, "") // remover caracteres especiais
    .replace(/\s+/g, " ") // normalizar espaços
    .trim()
    .substring(0, 50); // truncar para comparação
}

// Agrupar transações por similaridade
function agruparTransacoes(
  transacoes: Array<{
    descricao_raw: string | null;
    valor: number;
    categoria: string | null;
    data: string;
    estabelecimento: string | null;
  }>
): LeakGrupo[] {
  const grupos: Map<string, LeakGrupo> = new Map();

  for (const t of transacoes) {
    const descricao = t.descricao_raw || t.estabelecimento || "Sem descrição";
    const chave = normalizarDescricao(descricao);

    if (!chave || chave.length < 3) continue;

    if (grupos.has(chave)) {
      const grupo = grupos.get(chave)!;
      grupo.total_gasto += Math.abs(t.valor);
      grupo.quantidade_vezes += 1;
      grupo.media_por_vez = grupo.total_gasto / grupo.quantidade_vezes;
      if (t.data < grupo.primeira_ocorrencia) grupo.primeira_ocorrencia = t.data;
      if (t.data > grupo.ultima_ocorrencia) grupo.ultima_ocorrencia = t.data;
    } else {
      grupos.set(chave, {
        nome_normalizado: chave,
        descricao_raw_principal: descricao,
        total_gasto: Math.abs(t.valor),
        quantidade_vezes: 1,
        media_por_vez: Math.abs(t.valor),
        primeira_ocorrencia: t.data,
        ultima_ocorrencia: t.data,
        estabelecimento: t.estabelecimento || undefined,
        categoria: t.categoria || undefined,
      });
    }
  }

  // Filtrar apenas grupos com 3+ ocorrências OU gastos significativos
  return Array.from(grupos.values())
    .filter(
      (g) =>
        g.quantidade_vezes >= 3 ||
        (g.total_gasto >= 50 && g.quantidade_vezes >= 2)
    )
    .sort((a, b) => b.total_gasto - a.total_gasto);
}

export const leaksRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /api/leaks/analyze - Analisar vazamentos financeiros
  app.get<{
    Querystring: { periodo?: string };
  }>(
    "/analyze",
    { preHandler: [authHook] },
    async (request, reply) => {
      try {
        // CAMADA 1: Autenticação e Supabase
        app.log.info({ userId: request.user?.id }, "LEAKS: início do handler");
        const supabase = app.supabaseAdmin;
        app.log.info({ supabase: !!supabase, hasUserId: !!request.user?.id }, "LEAKS: supabase obtido");

        const userId = request.user?.id;
        if (!userId) {
          app.log.warn("LEAKS: usuário não autenticado");
          return reply.status(401).send({
            success: false,
            error: "Não autorizado",
          });
        }

        const periodo = parseInt(request.query.periodo || "90");
        const dataInicio = new Date();
        dataInicio.setDate(dataInicio.getDate() - periodo);

        // CAMADA 2: Query de transações
        app.log.info({ userId, periodo }, "LEAKS: buscando transações");

        const { data: transacoes, error } = await supabase
          .from("transactions")
          .select("descricao_raw, valor, categoria, data, estabelecimento")
          .eq("user_id", userId)
          .lt("valor", 0) // apenas débitos
          .gte("data", dataInicio.toISOString().split("T")[0])
          .order("data", { ascending: false });

        app.log.info({
          count: transacoes?.length,
          error: error,
          userId
        }, "LEAKS: transações obtidas");

        if (error) {
          app.log.error({ error }, "LEAKS: erro ao buscar transações");
          return reply.status(500).send({
            success: false,
            error: "Erro ao buscar transações",
          });
        }

        if (!transacoes || transacoes.length === 0) {
          app.log.info("LEAKS: sem transações no período");
          return reply.send({
            success: true,
            data: {
              vazamentos: [],
              total_vazamentos: 0,
              economia_anual_total: 0,
              categoria_mais_vazamentos: null,
              insight_principal:
                "Não encontramos transações suficientes para análise neste período.",
              periodo,
              data_analise: new Date().toISOString(),
            },
          });
        }

        // CAMADA 3: Processamento/agrupamento
        app.log.info("LEAKS: agrupando transações");
        const grupos = agruparTransacoes(transacoes);
        app.log.info({ grupos: grupos?.length }, "LEAKS: grupos criados");

        if (grupos.length === 0) {
          app.log.info("LEAKS: sem grupos de gastos");
          return reply.send({
            success: true,
            data: {
              vazamentos: [],
              total_vazamentos: 0,
              economia_anual_total: 0,
              categoria_mais_vazamentos: null,
              insight_principal:
                "Não identificamos padrões de gastos recorrentes neste período.",
              periodo,
              data_analise: new Date().toISOString(),
            },
          });
        }

        // CAMADA 4: Chamada ao Claude API
        app.log.info("LEAKS: verificando API key");
        app.log.info({ hasApiKey: !!process.env.CLAUDE_API_KEY }, "LEAKS: CLAUDE_API_KEY");

        if (!process.env.CLAUDE_API_KEY) {
          app.log.error("LEAKS: CLAUDE_API_KEY não definida!");
          return reply.status(500).send({
            success: false,
            error: "Configuração incompleta: CLAUDE_API_KEY não definida",
          });
        }

        // Usar Claude Haiku para analisar e classificar vazamentos
        const Anthropic = (await import("@anthropic-ai/sdk")).default;
        const anthropic = new Anthropic({
          apiKey: process.env.CLAUDE_API_KEY || "",
        });

        app.log.info("LEAKS: chamando Claude API");

        const prompt = `Analise estes grupos de gastos e identifique "vazamentos financeiros" — pequenos gastos recorrentes que passam despercebidos mas somam um valor significativo.

GRUPOS DE GASTOS (${periodo} dias):
${JSON.stringify(grupos.slice(0, 30), null, 2)}

Retorne SOMENTE um JSON válido (sem markdown, sem texto adicional):
{
  "vazamentos": [
    {
      "nome": "nome amigável do gasto",
      "categoria": "categoria",
      "total_periodo": 0,
      "quantidade_vezes": 0,
      "media_por_ocorrencia": 0,
      "frequencia": "diario|semanal|quinzenal|mensal|irregular",
      "tipo": "assinatura_esquecida|habito|conveniencia|taxa_bancaria|outro",
      "descricao_raw_principal": "descrição original",
      "nivel_alerta": "alto|medio|baixo",
      "sugestao": "sugestão específica e acionável em 1 frase",
      "economia_anual_potencial": 0
    }
  ],
  "total_vazamentos": 0,
  "economia_anual_total": 0,
  "categoria_mais_vazamentos": "categoria",
  "insight_principal": "insight mais importante em 1-2 frases"
}

Critérios para vazamento:
- Gasto repetido 3+ vezes no período
- OU assinatura que o usuário pode não lembrar
- OU taxas bancárias evitáveis
- OU gastos de conveniência com alta frequência
- Ordenar por economia_anual_potencial decrescente
- Máximo 10 vazamentos
- Para economia_anual_potencial, calcule baseado na frequência e valor do gasto`;

        // Chamada com timeout de 25 segundos
        let response;
        try {
          response = await Promise.race([
            anthropic.messages.create({
              model: "claude-haiku-4-20250514",
              max_tokens: 4096,
              messages: [{ role: "user", content: prompt }],
            }),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("TIMEOUT: Claude API excedeu 25 segundos")), 25000)
            )
          ]);
          app.log.info({ status: response?.status, stopReason: response?.stop_reason }, "LEAKS: Claude respondeu");
        } catch (apiError: any) {
          app.log.error({ error: apiError?.message, code: apiError?.code }, "LEAKS: erro na chamada ao Claude");
          return reply.status(500).send({
            success: false,
            error: `Erro na análise: ${apiError?.message || "Falha ao comunicar com Claude API"}`,
          });
        }

        const responseText = response.content[0].type === "text"
          ? response.content[0].text
          : "";

        // CAMADA 5: Parse do JSON
        app.log.info({ rawText: responseText?.substring(0, 200) }, "LEAKS: texto Claude");

        // Parsear resposta JSON
        let analysisData: Partial<AnalysisResult>;
        try {
          // Limpar resposta (remover markdown se existir)
          const cleanJson = responseText
            .replace(/```json\s*/g, "")
            .replace(/```\s*/g, "")
            .trim();
          app.log.info({ cleanJson: cleanJson?.substring(0, 200) }, "LEAKS: JSON limpo");
          analysisData = JSON.parse(cleanJson);
          app.log.info("LEAKS: JSON parseado com sucesso");
        } catch (parseError) {
          app.log.error({
            error: parseError,
            rawText: responseText?.substring(0, 500)
          }, "LEAKS: erro ao parsear resposta da IA");
          // Fallback: criar análise básica
          analysisData = {
            vazamentos: grupos.slice(0, 5).map((g) => ({
              nome: g.descricao_raw_principal,
              categoria: g.categoria || "Outros",
              total_periodo: g.total_gasto,
              quantidade_vezes: g.quantidade_vezes,
              media_por_ocorrencia: g.media_por_vez,
              frequencia:
                g.quantidade_vezes >= periodo / 7
                  ? "diario"
                  : g.quantidade_vezes >= periodo / 14
                    ? "semanal"
                    : g.quantidade_vezes >= periodo / 30
                      ? "quinzenal"
                      : "mensal",
              tipo: "outro",
              descricao_raw_principal: g.descricao_raw_principal,
              nivel_alerta:
                g.total_gasto >= 500 ? "alto" : g.total_gasto >= 200 ? "medio" : "baixo",
              sugestao: "Revise este gasto e avalie se é realmente necessário.",
              economia_anual_potencial: g.total_gasto * (365 / periodo) * 0.3,
            })),
            total_vazamentos: 0,
            economia_anual_total: 0,
            categoria_mais_vazamentos: "Outros",
            insight_principal: "Identificamos alguns gastos recorrentes que podem ser otimizados.",
          };
        }

        const result: AnalysisResult = {
          vazamentos: analysisData.vazamentos || [],
          total_vazamentos: analysisData.vazamentos?.reduce((sum, v) => sum + v.total_periodo, 0) || 0,
          economia_anual_total: analysisData.economia_anual_total ||
            (analysisData.vazamentos?.reduce((sum, v) => sum + (v.economia_anual_potencial || 0), 0) || 0),
          categoria_mais_vazamentos: analysisData.categoria_mais_vazamentos || "Outros",
          insight_principal: analysisData.insight_principal || "Continue monitorando seus gastos.",
          periodo,
          data_analise: new Date().toISOString(),
        };

        // Salvar análise no histórico
        try {
          await supabase.from("leaks_analysis").insert({
            user_id: userId,
            periodo,
            resultado: result,
            created_at: new Date().toISOString(),
          });
        } catch (saveError) {
          app.log.error("Erro ao salvar análise:", saveError);
          // Não falha a requisição por causa do save
        }

        return reply.send({
          success: true,
          data: result,
        });
      } catch (error: any) {
        app.log.error({
          msg: "LEAKS: Erro na análise de vazamentos — DETALHES COMPLETOS",
          error: error?.message || String(error),
          stack: error?.stack,
          name: error?.name,
          code: error?.code,
          details: error?.details,
          hint: error?.hint,
          status: error?.status,
          statusCode: error?.statusCode,
          response: error?.response?.data
        }, "LEAKS: catch principal");
        return reply.status(500).send({
          success: false,
          error: "Erro ao analisar vazamentos",
          debug: error?.message
        });
      }
    }
  );

  // GET /api/leaks/history - Histórico de análises
  app.get(
    "/history",
    { preHandler: [authHook] },
    async (request, reply) => {
      try {
        app.log.info({ userId: request.user?.id }, "LEAKS: history - início");
        const supabase = app.supabaseAdmin;
        app.log.info({ hasSupabase: !!supabase }, "LEAKS: history - supabase obtido");

        const userId = request.user?.id;
        if (!userId) {
          app.log.warn("LEAKS: history - usuário não autenticado");
          return reply.status(401).send({
            success: false,
            error: "Não autorizado",
          });
        }

        app.log.info("LEAKS: history - buscando histórico");
        const { data: history, error } = await supabase
          .from("leaks_analysis")
          .select("periodo, resultado, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(5);

        app.log.info({ count: history?.length, error }, "LEAKS: history - resultado");

        if (error) {
          app.log.error({ error }, "LEAKS: history - erro ao buscar");
          return reply.status(500).send({
            success: false,
            error: "Erro ao buscar histórico",
          });
        }

        return reply.send({
          success: true,
          data: history || [],
        });
      } catch (error: any) {
        app.log.error({
          msg: "LEAKS: Erro no histórico",
          error: error?.message || String(error),
          stack: error?.stack
        }, "LEAKS: history - catch");
        return reply.status(500).send({
          success: false,
          error: "Erro ao buscar histórico",
        });
      }
    }
  );
};
