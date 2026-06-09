import Redis from "ioredis";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { env } from "../env.js";

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  reconnectOnError(err) {
    const targetError = "READONLY";
    if (err.message.includes(targetError)) {
      return true;
    }
    return false;
  },
});

redis.on("connect", () => {
  console.log("✅ Redis conectado");
});

redis.on("error", (err) => {
  console.error("❌ Redis erro:", err.message);
});

async function redisPlugin(fastify: FastifyInstance) {
  fastify.decorate("redis", redis);

  fastify.addHook("onClose", async () => {
    await redis.quit();
  });

  fastify.log.info("✅ Plugin Redis carregado");
}

export default fp(redisPlugin, {
  name: "redis",
});

declare module "fastify" {
  interface FastifyInstance {
    redis: Redis;
  }
}