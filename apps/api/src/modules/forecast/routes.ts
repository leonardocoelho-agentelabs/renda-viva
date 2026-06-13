import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { authHook } from "../../plugins/auth.js";
import { gerarPrevisaoSaldo } from "../../services/forecast.service.js";

const forecastRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // GET /forecast - Previsões dos próximos 30 dias (gera se não houver)
  fastify.get(
    "/",
    { preHandler: [authHook] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const hoje = new Date().toISOString().split("T")[0];

        const buscar = () =>
          fastify.supabaseAdmin
            .from("forecasts")
            .select("data_prevista, saldo_projetado, confianca")
            .eq("user_id", userId)
            .gte("data_prevista", hoje)
            .order("data_prevista", { ascending: true })
            .limit(30);

        let { data: previsoes } = await buscar();

        // Se não houver previsões, gera automaticamente e busca de novo
        if (!previsoes || previsoes.length === 0) {
          await gerarPrevisaoSaldo(userId);
          ({ data: previsoes } = await buscar());
        }

        return reply.send(previsoes || []);
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em GET /forecast");
        return reply.status(500).send({
          success: false,
          error: "Erro ao buscar previsão de saldo",
        });
      }
    }
  );

  // POST /forecast/generate - Recalcula a previsão
  fastify.post(
    "/generate",
    { preHandler: [authHook] },
    async (request, reply) => {
      try {
        const total = await gerarPrevisaoSaldo(request.user!.id);
        return reply.send({ gerado: total > 0, total_dias: total });
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em POST /forecast/generate");
        return reply.status(500).send({
          success: false,
          error: "Erro ao gerar previsão de saldo",
        });
      }
    }
  );
};

export { forecastRoutes };
export default forecastRoutes;
