import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";

export interface AuthUser {
  id: string;
  email: string;
}

async function authPlugin(fastify: FastifyInstance) {
  // O decorator 'user' já está declarado na extensão de tipos abaixo
  // Não precisamos decorá-lo aqui
}

// Hook para validar JWT - usar como preHandler em rotas protegidas
export async function authHook(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      return reply.status(401).send({
        success: false,
        error: "Authorization header missing",
        code: "UNAUTHORIZED",
      });
    }

    if (!authHeader.startsWith("Bearer ")) {
      return reply.status(401).send({
        success: false,
        error: "Invalid authorization format. Use: Bearer <token>",
        code: "INVALID_AUTH_FORMAT",
      });
    }

    // Decodificar JWT usando jwtVerify do Fastify
    const decoded = await request.server.jwtVerify();

    // Injetar usuário na request
    (request as FastifyRequest & { user: AuthUser }).user = {
      id: decoded.sub as string,
      email: decoded.email as string || "",
    };
  } catch (err) {
    request.log.error("Auth error:", err);
    return reply.status(401).send({
      success: false,
      error: "Invalid or expired token",
      code: "INVALID_TOKEN",
    });
  }
}

export default fp(authPlugin, {
  name: "auth",
});

// Extensão de tipos
declare module "fastify" {
  interface FastifyRequest {
    user: AuthUser | null;
  }
}