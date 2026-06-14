import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { authHook } from "../../plugins/auth.js";
import { gerarInsights } from "../../services/insights.service.js";

const CACHE_TTL = 6 * 60 * 60; // 6 horas

const insightsRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // GET /insights - retorna insights (cache de 6h no Redis)
  fastify.get(
    "/",
    { preHandler: [authHook] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const cacheKey = `insights:${userId}`;

        const cached = await fastify.redis.get(cacheKey);
        if (cached) {
          return reply.send({ insights: JSON.parse(cached), cached: true });
        }

        const insights = await gerarInsights(userId);
        await fastify.redis.set(cacheKey, JSON.stringify(insights), "EX", CACHE_TTL);

        return reply.send({ insights, cached: false });
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em GET /insights");
        return reply.status(500).send({ success: false, error: "Erro ao gerar insights" });
      }
    }
  );

  // POST /insights/refresh - regenera e atualiza o cache
  fastify.post(
    "/refresh",
    { preHandler: [authHook] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const cacheKey = `insights:${userId}`;

        const insights = await gerarInsights(userId);
        await fastify.redis.set(cacheKey, JSON.stringify(insights), "EX", CACHE_TTL);

        return reply.send({ insights });
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em POST /insights/refresh");
        return reply.status(500).send({ success: false, error: "Erro ao atualizar insights" });
      }
    }
  );
};

export { insightsRoutes };
export default insightsRoutes;
