import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import Anthropic from "@anthropic-ai/sdk";
import { authHook, requireActiveSubscription } from "../../plugins/auth.js";
import { env } from "../../env.js";

const anthropic = new Anthropic({ apiKey: env.CLAUDE_API_KEY });

interface CreateGoalBody {
  nome: string;
  valor_alvo: number;
  data_alvo?: string | null;
  descricao?: string;
}

interface GoalPlan {
  aporte_mensal_necessario?: number;
  meses_necessarios?: number;
  instrumento_recomendado?: string;
  justificativa_instrumento?: string;
  viabilidade?: string;
  mensagem?: string;
  dica?: string;
  prioridade?: number;
}

// Extrai JSON (objeto) robustamente da resposta do Claude.
function extractJson(text: string): GoalPlan {
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
  return {};
}

const goalsRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // GET /goals - Lista metas do usuário, ordenadas por prioridade
  fastify.get(
    "/",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;

        const { data: metas, error } = await fastify.supabaseAdmin
          .from("goals")
          .select("*")
          .eq("user_id", userId)
          .order("prioridade", { ascending: true })
          .order("created_at", { ascending: false });

        if (error) {
          fastify.log.error({ err: error }, "Erro ao buscar metas");
          return reply.status(500).send({
            success: false,
            error: "Erro ao buscar metas",
          });
        }

        const metasComProgresso = (metas || []).map((m) => {
          const alvo = Number(m.valor_alvo);
          const atual = Number(m.valor_atual);
          const progresso = alvo > 0 ? (atual / alvo) * 100 : 0;
          return { ...m, progresso };
        });

        return reply.send({ goals: metasComProgresso });
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em GET /goals");
        return reply.status(500).send({
          success: false,
          error: "Erro ao buscar metas",
        });
      }
    }
  );

  // POST /goals - Cria meta com plano gerado pela IA
  fastify.post<{ Body: CreateGoalBody }>(
    "/",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const body = request.body;

        if (
          !body?.nome ||
          typeof body.nome !== "string" ||
          !body.nome.trim() ||
          typeof body.valor_alvo !== "number" ||
          body.valor_alvo <= 0
        ) {
          return reply.status(400).send({
            success: false,
            error: "Nome e valor alvo (positivo) são obrigatórios",
          });
        }

        const supabase = fastify.supabaseAdmin;

        // Contexto financeiro
        const { data: perfil } = await supabase
          .from("users")
          .select("renda_mensal")
          .eq("id", userId)
          .single();

        const tresM = new Date();
        tresM.setMonth(tresM.getMonth() - 3);

        const { data: transacoes } = await supabase
          .from("transactions")
          .select("valor, categoria")
          .eq("user_id", userId)
          .gte("data", tresM.toISOString().split("T")[0]);

        const totalGastos =
          transacoes
            ?.filter((t) => Number(t.valor) < 0)
            .reduce((s, t) => s + Math.abs(Number(t.valor)), 0) || 0;
        const totalReceitas =
          transacoes
            ?.filter((t) => Number(t.valor) > 0)
            .reduce((s, t) => s + Number(t.valor), 0) || 0;
        const mediaMensalDisponivel = (totalReceitas - totalGastos) / 3;

        const mesesParaMeta = body.data_alvo
          ? Math.ceil(
              (new Date(body.data_alvo).getTime() - Date.now()) /
                (1000 * 60 * 60 * 24 * 30)
            )
          : Math.ceil(body.valor_alvo / Math.max(mediaMensalDisponivel, 1));

        const prompt = `Você é um consultor financeiro. Analise esta meta e retorne SOMENTE JSON válido.

META DO USUÁRIO: ${body.nome}
VALOR ALVO: R$ ${body.valor_alvo}
PRAZO: ${
          body.data_alvo
            ? new Date(body.data_alvo).toLocaleDateString("pt-BR")
            : mesesParaMeta + " meses"
        }
RENDA MENSAL: R$ ${Number(perfil?.renda_mensal || 0)}
MÉDIA DISPONÍVEL POR MÊS (últimos 3 meses): R$ ${mediaMensalDisponivel.toFixed(2)}
GASTOS MENSAIS MÉDIOS: R$ ${(totalGastos / 3).toFixed(2)}

Retorne JSON:
{
  "aporte_mensal_necessario": 500.00,
  "meses_necessarios": 12,
  "instrumento_recomendado": "CDB",
  "justificativa_instrumento": "Para prazo de 12 meses, CDB com liquidez diária oferece segurança e rendimento acima da poupança",
  "viabilidade": "viavel",
  "mensagem": "Com R$ 500/mês você atinge a meta em 12 meses. Representa 25% da sua renda disponível.",
  "dica": "Automatize a transferência no dia do salário para não gastar antes de guardar",
  "prioridade": 2
}`;

        let plano: GoalPlan = {};
        try {
          const response = await anthropic.messages.create({
            model: "claude-haiku-4-5",
            max_tokens: 1024,
            messages: [{ role: "user", content: prompt }],
          });
          const first = response.content[0];
          const responseText =
            first && first.type === "text" ? first.text : "{}";
          plano = extractJson(responseText);
        } catch (aiErr) {
          // Se a IA falhar, cria a meta mesmo assim com valores padrão.
          fastify.log.error({ err: aiErr }, "Falha ao gerar plano da meta com IA");
        }

        const { data: meta, error: insertError } = await supabase
          .from("goals")
          .insert({
            user_id: userId,
            nome: body.nome.trim(),
            descricao: body.descricao || plano.mensagem || "",
            valor_alvo: body.valor_alvo,
            valor_atual: 0,
            data_alvo: body.data_alvo || null,
            instrumento_recomendado: plano.instrumento_recomendado || "Poupança",
            prioridade: plano.prioridade || 1,
            status: "ativa",
          })
          .select()
          .single();

        if (insertError || !meta) {
          fastify.log.error({ err: insertError }, "Erro ao inserir meta");
          return reply.status(500).send({
            success: false,
            error: "Erro ao criar meta",
          });
        }

        return reply.send({
          meta,
          plano,
          mensagem: plano.mensagem || "Meta criada com sucesso!",
        });
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em POST /goals");
        return reply.status(500).send({
          success: false,
          error: "Erro ao criar meta",
        });
      }
    }
  );

  // PATCH /goals/:id/deposit - Registra aporte
  fastify.patch<{ Params: { id: string }; Body: { valor: number } }>(
    "/:id/deposit",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const { id } = request.params;
        const { valor } = request.body || {};

        if (typeof valor !== "number" || valor <= 0 || !Number.isFinite(valor)) {
          return reply.status(400).send({
            success: false,
            error: "Valor de aporte inválido",
          });
        }

        const supabase = fastify.supabaseAdmin;

        const { data: meta, error: fetchError } = await supabase
          .from("goals")
          .select("*")
          .eq("id", id)
          .eq("user_id", userId)
          .single();

        if (fetchError || !meta) {
          return reply.status(404).send({
            success: false,
            error: "Meta não encontrada",
          });
        }

        const novoValor = Number(meta.valor_atual) + valor;
        const novoStatus =
          novoValor >= Number(meta.valor_alvo) ? "concluida" : meta.status;

        const { data: atualizada, error: updateError } = await supabase
          .from("goals")
          .update({ valor_atual: novoValor, status: novoStatus })
          .eq("id", id)
          .eq("user_id", userId)
          .select()
          .single();

        if (updateError || !atualizada) {
          return reply.status(500).send({
            success: false,
            error: "Erro ao registrar aporte",
          });
        }

        return reply.send({ success: true, meta: atualizada });
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em PATCH /goals/:id/deposit");
        return reply.status(500).send({
          success: false,
          error: "Erro ao registrar aporte",
        });
      }
    }
  );

  // PATCH /goals/:id/status - Atualiza status da meta
  fastify.patch<{
    Params: { id: string };
    Body: { status: "ativa" | "pausada" | "cancelada" };
  }>(
    "/:id/status",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const { id } = request.params;
        const { status } = request.body || {};

        const permitidos = ["ativa", "pausada", "cancelada"];
        if (!status || !permitidos.includes(status)) {
          return reply.status(400).send({
            success: false,
            error: "Status inválido",
          });
        }

        const { data: atualizada, error } = await fastify.supabaseAdmin
          .from("goals")
          .update({ status })
          .eq("id", id)
          .eq("user_id", userId)
          .select()
          .single();

        if (error || !atualizada) {
          return reply.status(404).send({
            success: false,
            error: "Meta não encontrada",
          });
        }

        return reply.send({ success: true, meta: atualizada });
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em PATCH /goals/:id/status");
        return reply.status(500).send({
          success: false,
          error: "Erro ao atualizar status",
        });
      }
    }
  );

  // DELETE /goals/:id - Remove meta
  fastify.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const { id } = request.params;

        const { data: meta } = await fastify.supabaseAdmin
          .from("goals")
          .select("id")
          .eq("id", id)
          .eq("user_id", userId)
          .single();

        if (!meta) {
          return reply.status(404).send({
            success: false,
            error: "Meta não encontrada",
          });
        }

        const { error } = await fastify.supabaseAdmin
          .from("goals")
          .delete()
          .eq("id", id)
          .eq("user_id", userId);

        if (error) {
          return reply.status(500).send({
            success: false,
            error: "Erro ao deletar meta",
          });
        }

        return reply.send({ success: true });
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em DELETE /goals/:id");
        return reply.status(500).send({
          success: false,
          error: "Erro ao deletar meta",
        });
      }
    }
  );
};

export { goalsRoutes };
export default goalsRoutes;
