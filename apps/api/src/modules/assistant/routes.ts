import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import Anthropic from "@anthropic-ai/sdk";
import { authHook } from "../../plugins/auth.js";
import { env } from "../../env.js";

const anthropic = new Anthropic({ apiKey: env.CLAUDE_API_KEY });

interface ChatHistoryItem {
  role: "user" | "assistant";
  content: string;
}

interface ChatBody {
  message: string;
  history?: ChatHistoryItem[];
}

const assistantRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // POST /assistant/chat - Conversa com o assistente financeiro "Viva"
  fastify.post<{ Body: ChatBody }>(
    "/chat",
    { preHandler: [authHook] },
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

        const systemPrompt = `Você é o assistente financeiro pessoal do Renda Viva, chamado "Viva".
Você tem acesso aos dados financeiros reais do usuário e responde de forma direta, personalizada e construtiva.
Sempre responda em português brasileiro.

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
- Responda sempre com base nos dados reais acima
- Nunca invente valores ou transações
- Seja direto e prático
- Quando perguntarem sobre compras ou decisões financeiras, calcule o impacto real com base nos dados
- Use o nome do usuário quando apropriado`;

        const messages = [
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
        const resposta =
          first && first.type === "text"
            ? first.text
            : "Desculpe, não consegui processar sua mensagem.";

        return reply.send({ response: resposta });
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em POST /assistant/chat");
        return reply.status(500).send({
          success: false,
          error: "Erro ao processar mensagem do assistente",
        });
      }
    }
  );
};

export { assistantRoutes };
export default assistantRoutes;
