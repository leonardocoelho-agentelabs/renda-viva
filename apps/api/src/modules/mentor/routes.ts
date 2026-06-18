import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { authHook, requireActiveSubscription } from "../../plugins/auth.js";
import {
  listarObjetivosMentor,
  criarObjetivoMentor,
  removerObjetivoMentor,
  runMentorAlerts,
} from "../../services/mentor.service.js";

interface CreateObjectiveBody {
  objetivo: string;
  valor_alvo?: number;
  prazo?: string;
}

interface DeleteObjectiveParams {
  id: string;
}

const mentorRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // GET /mentor/objectives - Lista objetivos do mentor
  fastify.get(
    "/objectives",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const supabase = fastify.supabase;
        const userId = request.user!.id;
        const objetivos = await listarObjetivosMentor(supabase, userId);

        return reply.send({
          success: true,
          objectives: objetivos,
        });
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em GET /mentor/objectives");
        return reply.status(500).send({
          success: false,
          error: "Erro ao buscar objetivos do mentor",
        });
      }
    }
  );

  // POST /mentor/objectives - Cria novo objetivo do mentor
  fastify.post<{ Body: CreateObjectiveBody }>(
    "/objectives",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const supabase = fastify.supabase;
        const userId = request.user!.id;
        const { objetivo, valor_alvo, prazo } = request.body || {};

        if (!objetivo || typeof objetivo !== "string" || !objetivo.trim()) {
          return reply.status(400).send({
            success: false,
            error: "Objetivo é obrigatório",
          });
        }

        const novoObjetivo = await criarObjetivoMentor(
          supabase,
          userId,
          objetivo.trim(),
          valor_alvo,
          prazo
        );

        return reply.status(201).send({
          success: true,
          objective: novoObjetivo,
          message: "Objetivo criado com sucesso!",
        });
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em POST /mentor/objectives");
        return reply.status(500).send({
          success: false,
          error: "Erro ao criar objetivo",
        });
      }
    }
  );

  // DELETE /mentor/objectives/:id - Remove objetivo do mentor
  fastify.delete<{ Params: DeleteObjectiveParams }>(
    "/objectives/:id",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const supabase = fastify.supabase;
        const userId = request.user!.id;
        const { id } = request.params;

        if (!id) {
          return reply.status(400).send({
            success: false,
            error: "ID do objetivo é obrigatório",
          });
        }

        await removerObjetivoMentor(supabase, userId, id);

        return reply.send({
          success: true,
          message: "Objetivo removido com sucesso",
        });
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em DELETE /mentor/objectives/:id");
        return reply.status(500).send({
          success: false,
          error: "Erro ao remover objetivo",
        });
      }
    }
  );

  // POST /mentor/run - Executa verificação manual dos alertas do mentor
  fastify.post(
    "/run",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const supabase = fastify.supabase;
        const userId = request.user!.id;

        await runMentorAlerts(supabase, userId);

        return reply.send({
          success: true,
          message: "Alertas do mentor executados com sucesso",
        });
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em POST /mentor/run");
        return reply.status(500).send({
          success: false,
          error: "Erro ao executar alertas do mentor",
        });
      }
    }
  );
};

export { mentorRoutes };
export default mentorRoutes;
