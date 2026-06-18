import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { authHook, requireActiveSubscription } from "../../plugins/auth.js";
import {
  gerarDiagnostico,
  buscarDiagnosticoRecente,
} from "../../services/diagnostico.service.js";

const diagnosticoRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // POST /diagnostico/gerar - Gera novo diagnóstico
  fastify.post(
    "/gerar",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;

        const diagnostico = await gerarDiagnostico(userId);

        return reply.status(201).send({
          success: true,
          diagnostico,
        });
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em POST /diagnostico/gerar");
        return reply.status(500).send({
          success: false,
          error: "Erro ao gerar diagnóstico",
        });
      }
    }
  );

  // GET /diagnostico/ultimo - Busca diagnóstico mais recente
  fastify.get(
    "/ultimo",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;

        const diagnostico = await buscarDiagnosticoRecente(userId);

        if (!diagnostico) {
          return reply.status(404).send({
            success: false,
            error: "Nenhum diagnóstico encontrado",
          });
        }

        return reply.send({
          success: true,
          diagnostico,
        });
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em GET /diagnostico/ultimo");
        return reply.status(500).send({
          success: false,
          error: "Erro ao buscar diagnóstico",
        });
      }
    }
  );
};

export { diagnosticoRoutes };
export default diagnosticoRoutes;
