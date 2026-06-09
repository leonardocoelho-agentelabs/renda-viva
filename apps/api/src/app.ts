import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { healthRoutes } from "./routes/health.js";

async function buildApp() {
  const app = Fastify({
    logger: {
      level: "info",
    },
  });

  // Plugins
  await app.register(cors, {
    origin: process.env.NODE_ENV === "production"
      ? ["https://rendaviva.com"]
      : true,
    credentials: true,
  });

  await app.register(jwt, {
    secret: process.env.JWT_SECRET || "development-secret-change-in-production",
  });

  // Routes
  await app.register(healthRoutes, { prefix: "/api" });

  // Global error handler
  app.setErrorHandler((error, request, reply) => {
    app.log.error(error);
    reply.status(500).send({
      statusCode: 500,
      error: "Internal Server Error",
      message: process.env.NODE_ENV === "development" ? error.message : "Something went wrong",
    });
  });

  return app;
}

async function start() {
  const app = await buildApp();

  const port = parseInt(process.env.PORT || "3001", 10);
  const host = process.env.HOST || "0.0.0.0";

  try {
    await app.listen({ port, host });
    console.log(`🚀 Server running at http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

export { buildApp };

// Start server if running directly
start();