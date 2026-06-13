import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { authHook } from "../../plugins/auth.js";
import { calcularScore } from "./service.js";

const scoreRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // POST /score/calculate - Recalcula e persiste o score
  fastify.post(
    "/calculate",
    { preHandler: [authHook] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const resultado = await calcularScore(userId);
        return reply.send(resultado);
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em POST /score/calculate");
        return reply.status(500).send({
          success: false,
          error: "Erro ao calcular score",
        });
      }
    }
  );

  // GET /score/current - Retorna o score com detalhamento (recalculado)
  fastify.get(
    "/current",
    { preHandler: [authHook] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        // Recalcula para garantir que o detalhamento reflete os dados atuais
        const resultado = await calcularScore(userId);
        return reply.send(resultado);
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em GET /score/current");
        return reply.status(500).send({
          success: false,
          error: "Erro ao buscar score",
        });
      }
    }
  );
};

export { scoreRoutes };
export default scoreRoutes;
