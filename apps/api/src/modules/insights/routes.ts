import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { authHook, requireActiveSubscription } from "../../plugins/auth.js";
import { gerarInsights } from "../../services/insights.service.js";

const CACHE_TTL = 6 * 60 * 60; // 6 horas

const insightsRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // GET /insights - retorna insights (cache de 6h no Redis)
  fastify.get(
    "/",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const cacheKey = `insights:${userId}`;

        // Cache é opcional: se o Redis estiver indisponível (ex: réplica read-only),
        // seguimos sem cache em vez de quebrar o endpoint.
        let cached: string | null = null;
        try {
          cached = await fastify.redis.get(cacheKey);
        } catch (redisErr) {
          fastify.log.warn({ err: redisErr }, "Redis indisponível (leitura) — gerando insights sem cache");
        }
        if (cached) {
          return reply.send({ insights: JSON.parse(cached), cached: true });
        }

        const insights = await gerarInsights(userId);
        try {
          await fastify.redis.set(cacheKey, JSON.stringify(insights), "EX", CACHE_TTL);
        } catch (redisErr) {
          fastify.log.warn({ err: redisErr }, "Redis indisponível (escrita) — continuando sem cache");
        }

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
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const cacheKey = `insights:${userId}`;

        const insights = await gerarInsights(userId);
        try {
          await fastify.redis.set(cacheKey, JSON.stringify(insights), "EX", CACHE_TTL);
        } catch (redisErr) {
          fastify.log.warn({ err: redisErr }, "Redis indisponível (escrita) — continuando sem cache");
        }

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
