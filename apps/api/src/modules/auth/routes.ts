import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { authHook } from "../../plugins/auth.js";

const authRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // GET /auth/me - Retorna dados do usuário autenticado
  fastify.get(
    "/me",
    { preHandler: [authHook] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;

        // Buscar perfil do usuário
        const { data: user, error } = await fastify.supabaseAdmin
          .from("users")
          .select("*")
          .eq("id", userId)
          .single();

        if (error) {
          fastify.log.error("Erro ao buscar usuário:", error);
          return reply.status(404).send({
            success: false,
            error: "Usuário não encontrado",
          });
        }

        return reply.send({
          success: true,
          data: {
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            renda_mensal: user.renda_mensal,
            perfil_risco: user.perfil_risco,
            modo_crise: user.modo_crise,
            score_saude: user.score_saude,
          },
        });
      } catch (err) {
        fastify.log.error("Erro em /auth/me:", err);
        return reply.status(500).send({
          success: false,
          error: "Erro interno",
        });
      }
    }
  );
};

export { authRoutes };