import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import Anthropic from "@anthropic-ai/sdk";
import { authHook, requireActiveSubscription } from "../../plugins/auth.js";
import { env } from "../../env.js";
import {
  getVivaMemory,
  extractAndSaveMemories,
} from "../../services/viva-memory.service.js";

const anthropic = new Anthropic({ apiKey: env.CLAUDE_API_KEY });

interface ChatHistoryItem {
  role: "user" | "assistant";
  content: string;
}

interface ChatBody {
  message: string;
  history?: ChatHistoryItem[];
  sessionId?: string;
}

const assistantRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // POST /assistant/chat - Conversa com o assistente financeiro "Viva"
  fastify.post<{ Body: ChatBody }>(
    "/chat",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const body = request.body;

        if (!body?.message || typeof body.message !== "string" || !body.message.trim()) {
          return reply.status(400).send({
            success: false,
            error: "Mensagem é obrigatória",
          });
        }

        const supabase = fastify.supabaseAdmin;
        const sessionId = body.sessionId || crypto.randomUUID();

        // 1. Perfil do usuário
        const { data: perfil } = await supabase
          .from("users")
          .select("full_name, renda_mensal, perfil_risco, score_saude")
          .eq("id", userId)
          .single();

        // 2. Transações do mês atual
        const hoje = new Date();
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
          .toISOString()
          .split("T")[0];
        const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
          .toISOString()
          .split("T")[0];

        const { data: transacoes } = await supabase
          .from("transactions")
          .select("data, valor, descricao_raw, categoria, tipo")
          .eq("user_id", userId)
          .gte("data", inicioMes)
          .lte("data", fimMes)
          .order("data", { ascending: false })
          .limit(30);

        // 3. Resumo financeiro
        const saldo = transacoes?.reduce((sum, t) => sum + Number(t.valor), 0) || 0;
        const totalGastos =
          transacoes
            ?.filter((t) => Number(t.valor) < 0)
            .reduce((sum, t) => sum + Math.abs(Number(t.valor)), 0) || 0;
        const totalReceitas =
          transacoes
            ?.filter((t) => Number(t.valor) > 0)
            .reduce((sum, t) => sum + Number(t.valor), 0) || 0;

        // 4. Top categorias de gasto
        const porCategoria = (transacoes || [])
          .filter((t) => Number(t.valor) < 0 && t.categoria)
          .reduce((acc, t) => {
            const cat = t.categoria as string;
            acc[cat] = (acc[cat] || 0) + Math.abs(Number(t.valor));
            return acc;
          }, {} as Record<string, number>);

        const topCategorias = Object.entries(porCategoria)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([cat, valor]) => `${cat}: R$ ${valor.toFixed(2)}`)
          .join(", ");

        // 5. Metas ativas
        const { data: metas } = await supabase
          .from("goals")
          .select("nome, valor_alvo, valor_atual, data_alvo")
          .eq("user_id", userId)
          .eq("status", "ativa")
          .limit(5);

        const periodo = hoje.toLocaleDateString("pt-BR", {
          month: "long",
          year: "numeric",
        });

        const ultimasTransacoes = (transacoes || [])
          .slice(0, 15)
          .map(
            (t) =>
              `- ${t.data}: ${t.descricao_raw} (${t.categoria || "Sem categoria"}): R$ ${Number(
                t.valor
              ).toFixed(2)}`
          )
          .join("\n");

        const blocoMetas =
          metas && metas.length > 0
            ? `METAS ATIVAS:\n${metas
                .map(
                  (m) =>
                    `- ${m.nome}: R$ ${Number(m.valor_atual || 0).toFixed(2)}/${Number(
                      m.valor_alvo
                    ).toFixed(2)} (prazo: ${m.data_alvo || "sem prazo"})`
                )
                .join("\n")}`
            : "";

        // 6. Buscar memórias de longo prazo
        const memorias = await getVivaMemory(supabase, userId);

        // 7. Buscar histórico persistido da sessão
        const { data: historyMessages } = await supabase
          .from("conversation_history")
          .select("role, content")
          .eq("user_id", userId)
          .eq("session_id", sessionId)
          .order("created_at", { ascending: true })
          .limit(10);

        const systemPrompt = `Você é o assistente financeiro pessoal do Renda Viva, chamado "Viva".
Você tem acesso aos dados financeiros reais do usuário e responde de forma direta, personalizada e construtiva.
Sempre responda em português brasileiro.

${memorias}

DADOS FINANCEIROS DO USUÁRIO (${periodo}):
- Nome: ${perfil?.full_name || "Usuário"}
- Renda mensal declarada: R$ ${Number(perfil?.renda_mensal || 0).toFixed(2)}
- Perfil de investidor: ${perfil?.perfil_risco || "moderado"}
- Saldo do mês: R$ ${saldo.toFixed(2)}
- Total de receitas: R$ ${totalReceitas.toFixed(2)}
- Total de gastos: R$ ${totalGastos.toFixed(2)}
- Top categorias de gasto: ${topCategorias || "Sem dados"}

ÚLTIMAS TRANSAÇÕES:
${ultimasTransacoes || "Sem transações no período."}

${blocoMetas}

INSTRUÇÕES:
- Use as memórias para personalizar suas respostas
- Se o usuário mencionar algo relacionado a uma memória, faça referência a ela
- Responda sempre com base nos dados reais acima
- Nunca invente valores ou transações
- Seja direto e prático
- Quando perguntarem sobre compras ou decisões financeiras, calcule o impacto real com base nos dados
- Use o nome do usuário quando apropriado`;

        const messages = [
          ...(historyMessages || [])
            .filter((h) => h && (h.role === "user" || h.role === "assistant") && h.content)
            .map((h) => ({
              role: h.role,
              content: h.content,
            })),
          ...(body.history || [])
            .filter((h) => h && (h.role === "user" || h.role === "assistant") && h.content)
            .map((h) => ({
              role: h.role,
              content: h.content,
            })),
          { role: "user" as const, content: body.message },
        ];

        const response = await anthropic.messages.create({
          model: "claude-haiku-4-5",
          max_tokens: 1024,
          system: systemPrompt,
          messages,
        });

        const first = response.content[0];
        const respostaViva =
          first && first.type === "text"
            ? first.text
            : "Desculpe, não consegui processar sua mensagem.";

        // 8. Salvar mensagens no histórico persistido
        await supabase.from("conversation_history").insert([
          {
            user_id: userId,
            session_id: sessionId,
            role: "user",
            content: body.message,
          },
          {
            user_id: userId,
            session_id: sessionId,
            role: "assistant",
            content: respostaViva,
          },
        ]);

        // 9. Extrair e salvar novas memórias
        await extractAndSaveMemories(supabase, userId, body.message, respostaViva);

        return reply.send({ response: respostaViva, sessionId });
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em POST /assistant/chat");
        return reply.status(500).send({
          success: false,
          error: "Erro ao processar mensagem do assistente",
        });
      }
    }
  );

  // GET /assistant/history - Buscar histórico de mensagens
  fastify.get(
    "/history",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const sessionId = (request.query as { session_id?: string }).session_id;
        const supabase = fastify.supabaseAdmin;

        let query = supabase
          .from("conversation_history")
          .select("role, content, created_at, session_id")
          .eq("user_id", userId)
          .order("created_at", { ascending: true })
          .limit(50);

        if (sessionId) {
          query = query.eq("session_id", sessionId);
        }

        const { data, error } = await query;

        if (error) {
          return reply.status(500).send({ success: false, error: error.message });
        }

        return reply.send({ success: true, messages: data || [] });
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em GET /assistant/history");
        return reply.status(500).send({
          success: false,
          error: "Erro ao buscar histórico",
        });
      }
    }
  );

  // GET /assistant/sessions - Listar sessões anteriores
  fastify.get(
    "/sessions",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const supabase = fastify.supabaseAdmin;

        const { data, error } = await supabase
          .from("conversation_history")
          .select("session_id, content, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (error) {
          return reply.status(500).send({ success: false, error: error.message });
        }

        // Agrupar por sessão
        const sessoesMap = new Map<
          string,
          { session_id: string; primeira_mensagem: string; total_mensagens: number; created_at: string }
        >();

        if (data) {
          for (const msg of data) {
            if (!sessoesMap.has(msg.session_id)) {
              sessoesMap.set(msg.session_id, {
                session_id: msg.session_id,
                primeira_mensagem: msg.content.substring(0, 100),
                total_mensagens: 0,
                created_at: msg.created_at,
              });
            }
            const sessao = sessoesMap.get(msg.session_id)!;
            sessao.total_mensagens++;
          }
        }

        const sessoes = Array.from(sessoesMap.values())
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 10);

        return reply.send({ success: true, sessions: sessoes });
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em GET /assistant/sessions");
        return reply.status(500).send({
          success: false,
          error: "Erro ao buscar sessões",
        });
      }
    }
  );

  // DELETE /assistant/history - Limpar histórico do usuário
  fastify.delete(
    "/history",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const supabase = fastify.supabaseAdmin;

        const { error } = await supabase
          .from("conversation_history")
          .delete()
          .eq("user_id", userId);

        if (error) {
          return reply.status(500).send({ success: false, error: error.message });
        }

        return reply.send({ success: true, message: "Histórico limpo com sucesso" });
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em DELETE /assistant/history");
        return reply.status(500).send({
          success: false,
          error: "Erro ao limpar histórico",
        });
      }
    }
  );

  // GET /assistant/memory - Buscar memórias da Viva
  fastify.get(
    "/memory",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const supabase = fastify.supabaseAdmin;

        const { data, error } = await supabase
          .from("viva_memory")
          .select("tipo, titulo, conteudo, importancia, created_at")
          .eq("user_id", userId)
          .eq("ativo", true)
          .order("importancia", { ascending: false })
          .limit(20);

        if (error) {
          return reply.status(500).send({ success: false, error: error.message });
        }

        return reply.send({ success: true, memories: data || [], hasMemory: (data?.length || 0) > 0 });
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em GET /assistant/memory");
        return reply.status(500).send({
          success: false,
          error: "Erro ao buscar memórias",
        });
      }
    }
  );
};

export { assistantRoutes };
export default assistantRoutes;