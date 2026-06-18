import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { authHook, requireActiveSubscription } from "../../plugins/auth.js";
import {
  verificarModoCrise,
  desativarModoCrise,
  getModoCriseStatus,
} from "../../services/modo-crise.service.js";
import { calcularScore } from "../score/service.js";

const modoCriseRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // GET /users/modo-crise - Verifica e retorna status do modo crise
  fastify.get(
    "/",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;

        // Verificar modo crise
        const resultado = await verificarModoCrise(userId);

        return reply.send({
          modo_crise: resultado.em_crises,
          motivo: resultado.motivo || null,
          criterios: resultado.criterios,
        });
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em GET /users/modo-crise");
        return reply.status(500).send({
          success: false,
          error: "Erro ao verificar modo crise",
        });
      }
    }
  );

  // DELETE /users/modo-crise - Desativa modo crise manualmente
  fastify.delete(
    "/",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;

        await desativarModoCrise(userId);

        return reply.send({
          success: true,
          modo_crise: false,
          message: "Modo crise desativado com sucesso",
        });
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em DELETE /users/modo-crise");
        return reply.status(500).send({
          success: false,
          error: "Erro ao desativar modo crise",
        });
      }
    }
  );

  // POST /users/modo-crise/verificar - Força verificação (útil para workers)
  fastify.post(
    "/verificar",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;

        // Recalcular score primeiro
        await calcularScore(userId);

        // Verificar modo crise
        const resultado = await verificarModoCrise(userId);

        return reply.send({
          success: true,
          modo_crise: resultado.em_crises,
          motivo: resultado.motivo || null,
          criterios: resultado.criterios,
        });
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em POST /users/modo-crise/verificar");
        return reply.status(500).send({
          success: false,
          error: "Erro ao verificar modo crise",
        });
      }
    }
  );
};

export { modoCriseRoutes };
export default modoCriseRoutes;
