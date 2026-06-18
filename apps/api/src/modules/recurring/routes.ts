import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { authHook, requireActiveSubscription } from "../../plugins/auth.js";
import {
  calcularProximoVencimento,
  formatarMensagemAlerta,
  getRecurringSummary,
  getRecurringCommitments,
  createRecurringCommitment,
  updateRecurringCommitment,
  cancelRecurringCommitment,
  payRecurringCommitment,
  runRecurringAlerts,
} from "../../services/recurring.service.js";

interface CreateCommitmentBody {
  nome: string;
  descricao?: string;
  categoria: string;
  tipo: "assinatura" | "parcela";
  valor: number;
  dia_vencimento: number;
  total_parcelas?: number;
  parcelas_pagas?: number;
  data_inicio?: string;
  alerta_whatsapp?: boolean;
}

interface UpdateCommitmentBody {
  nome?: string;
  descricao?: string;
  categoria?: string;
  valor?: number;
  dia_vencimento?: number;
  alerta_whatsapp?: boolean;
}

const recurringRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // GET /api/recurring - Lista todos os compromissos do usuário
  fastify.get<{ Querystring: { status?: string } }>(
    "/",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const status = request.query.status || "ativo";

        const supabase = fastify.supabaseAdmin;
        const commitments = await getRecurringCommitments(supabase, userId, status);

        return reply.send({ commitments });
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em GET /api/recurring");
        return reply.status(500).send({ success: false, error: "Erro ao buscar compromissos" });
      }
    }
  );

  // GET /api/recurring/summary - Retorna resumo para o dashboard
  fastify.get(
    "/summary",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const supabase = fastify.supabaseAdmin;
        const summary = await getRecurringSummary(supabase, userId);

        return reply.send(summary);
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em GET /api/recurring/summary");
        return reply.status(500).send({ success: false, error: "Erro ao buscar resumo" });
      }
    }
  );

  // POST /api/recurring - Cria novo compromisso
  fastify.post<{ Body: CreateCommitmentBody }>(
    "/",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const body = request.body;

        // Validações básicas
        if (!body?.nome?.trim()) {
          return reply.status(400).send({ success: false, error: "Nome é obrigatório" });
        }

        if (!body?.categoria?.trim()) {
          return reply.status(400).send({ success: false, error: "Categoria é obrigatória" });
        }

        if (body?.tipo !== "assinatura" && body?.tipo !== "parcela") {
          return reply.status(400).send({ success: false, error: "Tipo inválido" });
        }

        if (typeof body?.valor !== "number" || body.valor <= 0) {
          return reply.status(400).send({ success: false, error: "Valor deve ser maior que zero" });
        }

        if (typeof body?.dia_vencimento !== "number" || body.dia_vencimento < 1 || body.dia_vencimento > 31) {
          return reply.status(400).send({ success: false, error: "Dia de vencimento deve estar entre 1 e 31" });
        }

        // Validações específicas para parcelas
        if (body.tipo === "parcela") {
          if (typeof body?.total_parcelas !== "number" || body.total_parcelas < 2) {
            return reply.status(400).send({
              success: false,
              error: "Parcelas devem ter no mínimo 2 parcelas",
            });
          }

          const parcelasPagas = body?.parcelas_pagas ?? 0;
          if (parcelasPagas >= body.total_parcelas) {
            return reply.status(400).send({
              success: false,
              error: "Parcelas pagas não pode ser igual ou maior que total de parcelas",
            });
          }
        }

        const supabase = fastify.supabaseAdmin;
        const commitment = await createRecurringCommitment(supabase, userId, body);

        return reply.status(201).send({ commitment });
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em POST /api/recurring");
        return reply.status(500).send({ success: false, error: "Erro ao criar compromisso" });
      }
    }
  );

  // PATCH /api/recurring/:id - Atualiza compromisso
  fastify.patch<{ Params: { id: string }; Body: UpdateCommitmentBody }>(
    "/:id",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const { id } = request.params;
        const body = request.body;

        if (body?.valor !== undefined && body.valor <= 0) {
          return reply.status(400).send({ success: false, error: "Valor deve ser maior que zero" });
        }

        if (body?.dia_vencimento !== undefined && (body.dia_vencimento < 1 || body.dia_vencimento > 31)) {
          return reply.status(400).send({
            success: false,
            error: "Dia de vencimento deve estar entre 1 e 31",
          });
        }

        const supabase = fastify.supabaseAdmin;
        const commitment = await updateRecurringCommitment(supabase, userId, id, body);

        if (!commitment) {
          return reply.status(404).send({ success: false, error: "Compromisso não encontrado" });
        }

        return reply.send({ commitment });
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em PATCH /api/recurring/:id");
        return reply.status(500).send({ success: false, error: "Erro ao atualizar compromisso" });
      }
    }
  );

  // PATCH /api/recurring/:id/cancel - Cancela assinatura
  fastify.patch<{ Params: { id: string } }>(
    "/:id/cancel",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const { id } = request.params;

        // Buscar o compromisso primeiro para verificar tipo
        const { data: existing } = await fastify.supabaseAdmin
          .from("recurring_commitments")
          .select("id, tipo, nome, data_fim")
          .eq("id", id)
          .eq("user_id", userId)
          .single();

        if (!existing) {
          return reply.status(404).send({ success: false, error: "Compromisso não encontrado" });
        }

        if (existing.tipo === "parcela") {
          return reply.status(400).send({
            success: false,
            error: `Parcelas não podem ser canceladas. Aguarde a conclusão em ${existing.data_fim ? new Date(existing.data_fim).toLocaleDateString("pt-BR") : "estimada"}.`,
          });
        }

        const supabase = fastify.supabaseAdmin;
        const commitment = await cancelRecurringCommitment(supabase, userId, id);

        return reply.send({ commitment });
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em PATCH /api/recurring/:id/cancel");
        return reply.status(500).send({ success: false, error: "Erro ao cancelar compromisso" });
      }
    }
  );

  // PATCH /api/recurring/:id/pagar - Registra pagamento de parcela
  fastify.patch<{ Params: { id: string } }>(
    "/:id/pagar",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const { id } = request.params;

        const supabase = fastify.supabaseAdmin;
        const commitment = await payRecurringCommitment(supabase, userId, id);

        if (!commitment) {
          return reply.status(404).send({ success: false, error: "Compromisso não encontrado" });
        }

        return reply.send({ commitment });
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em PATCH /api/recurring/:id/pagar");
        return reply.status(500).send({ success: false, error: "Erro ao registrar pagamento" });
      }
    }
  );

  // POST /api/recurring/run-alerts - Endpoint interno para n8n executar alertas
  fastify.post(
    "/run-alerts",
    {
      preHandler: async (request, reply) => {
        // Verifica token interno
        const token = request.headers["x-internal-token"];
        const internalToken = process.env.INTERNAL_API_TOKEN || "renda-viva-internal";

        if (token !== internalToken) {
          return reply.status(401).send({ success: false, error: "Unauthorized" });
        }
      },
    },
    async (request, reply) => {
      try {
        const result = await runRecurringAlerts(fastify);
        return reply.send(result);
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em POST /api/recurring/run-alerts");
        return reply.status(500).send({ success: false, error: "Erro ao executar alertas" });
      }
    }
  );
};

export { recurringRoutes };
export default recurringRoutes;
