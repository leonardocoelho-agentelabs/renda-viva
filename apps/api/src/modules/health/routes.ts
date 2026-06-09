import type { FastifyInstance, FastifyPluginAsync } from "fastify";

const healthRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.get("/health", async (_request, reply) => {
    return reply.send({
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "renda-viva-api",
      version: "1.0.0",
      uptime: process.uptime(),
    });
  });
};

export { healthRoutes };