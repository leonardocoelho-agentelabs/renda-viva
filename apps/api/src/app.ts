import "dotenv/config";
import Fastify, { type FastifyError, type FastifyRequest, type FastifyReply } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import jwt from "@fastify/jwt";

import { env } from "./env.js";
import supabasePlugin from "./plugins/supabase.js";
import authPlugin from "./plugins/auth.js";
import redisPlugin from "./plugins/redis.js";

import { healthRoutes } from "./modules/health/routes.js";
import { authRoutes } from "./modules/auth/routes.js";
import { uploadsRoutes } from "./modules/uploads/routes.js";

async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "development" ? "info" : "warn",
    },
  });

  // Registrar plugins
  await app.register(cors, {
    origin: env.NODE_ENV === "production" ? ["https://rendaviva.com"] : true,
    credentials: true,
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  await app.register(multipart, {
    limits: {
      fileSize: 20 * 1024 * 1024, // 20MB
    },
  });

  await app.register(jwt, {
    secret: env.JWT_SECRET,
  });

  // Plugins personalizados
  await app.register(supabasePlugin);
  await app.register(authPlugin);
  await app.register(redisPlugin);

  // Registrar rotas
  await app.register(healthRoutes, { prefix: "/api" });
  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(uploadsRoutes, { prefix: "/api/uploads" });

  // Handler de erro global
  app.setErrorHandler((error: FastifyError, _request: FastifyRequest, reply: FastifyReply) => {
    app.log.error(error);

    // Erro de validação
    if (error.validation) {
      return reply.status(400).send({
        success: false,
        error: "Validação falhou",
        details: error.validation,
      });
    }

    // Erro de autenticação JWT
    if (error.statusCode === 401) {
      return reply.status(401).send({
        success: false,
        error: "Não autorizado",
        code: "UNAUTHORIZED",
      });
    }

    // Erro genérico
    return reply.status(error.statusCode || 500).send({
      success: false,
      error: env.NODE_ENV === "development" ? error.message : "Erro interno",
    });
  });

  // Handler para 404
  app.setNotFoundHandler((_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(404).send({
      success: false,
      error: "Rota não encontrada",
    });
  });

  return app;
}

async function start() {
  const app = await buildApp();

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    app.log.info(`${signal} recebido, encerrando...`);
    await app.close();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  try {
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 Renda Viva API                                       ║
║                                                           ║
║   Servidor rodando em: http://localhost:${env.PORT}          ║
║   Ambiente: ${env.NODE_ENV.padEnd(40)}║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Exportar para testes
export { buildApp };

// Iniciar se executado diretamente
start();