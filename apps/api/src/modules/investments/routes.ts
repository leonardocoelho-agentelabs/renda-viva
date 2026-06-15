import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { authHook, requireActiveSubscription } from "../../plugins/auth.js";
import { env } from "../../env.js";
import {
  gerarRadarSemanal,
  enviarRadarWhatsApp,
  type RadarResultado,
} from "../../services/radar.service.js";

// Cache em memória por usuário (1 hora) — evita chamar o Claude a cada request.
const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { ts: number; data: RadarResultado }>();

const investmentsRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // GET /investments/radar - Curadoria + dados de mercado (cache de 1h)
  fastify.get<{ Querystring: { refresh?: string } }>(
    "/radar",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const forcar = request.query?.refresh === "true";

        const cached = cache.get(userId);
        if (!forcar && cached && Date.now() - cached.ts < CACHE_TTL_MS) {
          return reply.send(cached.data);
        }

        const data = await gerarRadarSemanal(userId);
        cache.set(userId, { ts: Date.now(), data });
        return reply.send(data);
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em GET /investments/radar");
        return reply.status(500).send({
          success: false,
          error: "Erro ao gerar radar de investimentos",
        });
      }
    }
  );

  // POST /investments/radar/send-whatsapp - Envia o radar via WhatsApp
  fastify.post(
    "/radar/send-whatsapp",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const enviado = await enviarRadarWhatsApp(request.user!.id);
        return reply.send({ enviado });
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em POST /investments/radar/send-whatsapp");
        return reply.status(500).send({
          success: false,
          error: "Erro ao enviar radar via WhatsApp",
        });
      }
    }
  );

  // POST /investments/radar/run-all - (interno) gera e envia para todos os usuários
  fastify.post(
    "/radar/run-all",
    async (request, reply) => {
      if (request.headers["x-api-secret"] !== env.API_SECRET) {
        return reply.status(401).send({ success: false, error: "Não autorizado" });
      }

      const { data: usuarios, error } = await fastify.supabaseAdmin
        .from("users")
        .select("id");

      if (error) {
        return reply.status(500).send({ success: false, error: "Erro ao listar usuários" });
      }

      let processados = 0;
      let erros = 0;

      for (const u of usuarios || []) {
        try {
          await enviarRadarWhatsApp(u.id);
          processados++;
        } catch (e) {
          erros++;
          fastify.log.error({ err: e, userId: u.id }, "Erro ao enviar radar em lote");
        }
      }

      return reply.send({ processados, erros });
    }
  );
};

export { investmentsRoutes };
export default investmentsRoutes;
