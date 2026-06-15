import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { supabaseAdmin } from "./supabase.js";

export interface AuthUser {
  id: string;
  email: string;
}

// Hook para validar JWT do Supabase — usar como preHandler em rotas protegidas
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

    const token = authHeader.replace("Bearer ", "");

    // Verificar token usando o Supabase (não jwtVerify — o secret é do Supabase)
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      request.log.error(
        { error: error?.message, code: (error as any)?.code },
        "Auth error"
      );
      return reply.status(401).send({
        success: false,
        error: "Invalid or expired token",
        code: "INVALID_TOKEN",
      });
    }

    (request as FastifyRequest & { user: AuthUser }).user = {
      id: user.id,
      email: user.email ?? "",
    };
  } catch (err: any) {
    request.log.error(
      { error: err?.message, details: err },
      "Auth error inesperado"
    );
    return reply.status(401).send({
      success: false,
      error: "Erro de autenticação",
      code: "AUTH_ERROR",
    });
  }
}

// Hook para verificar assinatura ativa — usar como preHandler em rotas protegidas
export async function requireActiveSubscription(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const userId = (request as FastifyRequest & { user: AuthUser }).user?.id;
  if (!userId) {
    return reply.status(401).send({ error: "subscription_required" });
  }

  const { data } = await supabaseAdmin
    .from("subscriptions")
    .select("status")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const statusComAcesso = ["active", "overdue"];

  if (!data || !statusComAcesso.includes(data.status)) {
    return reply.status(403).send({ error: "subscription_required" });
  }
}

async function authPlugin(fastify: FastifyInstance) {
  fastify.decorate(
    "authenticate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      await authHook(request, reply);
    }
  );

  fastify.decorate(
    "requireActiveSubscription",
    async (request: FastifyRequest, reply: FastifyReply) => {
      await requireActiveSubscription(request, reply);
    }
  );
}

export default fp(authPlugin, {
  name: "auth",
});

// Extensão de tipos
declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireActiveSubscription: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    user: AuthUser | null;
  }
}
