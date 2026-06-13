import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { authHook } from "../../plugins/auth.js";
import { env } from "../../env.js";
import { enviarMensagemWhatsApp } from "../../services/whatsapp.service.js";
import {
  verificarAlertasOrcamento,
  verificarSaldoNegativo,
  enviarResumoSemanal,
} from "../../services/alerts.service.js";

function autorizadoInterno(secret: unknown): boolean {
  return secret === env.API_SECRET;
}

const alertsRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // POST /alerts/test - Mensagem de teste para validar a integração
  fastify.post(
    "/test",
    { preHandler: [authHook] },
    async (_request, reply) => {
      const ok = await enviarMensagemWhatsApp(
        env.ALERTS_TEST_NUMBER,
        "🎉 *Renda Viva* — Integração WhatsApp funcionando! Seus alertas financeiros estão ativos."
      );
      return reply.send({ enviado: ok });
    }
  );

  // POST /alerts/check-budget - Verifica alertas de orçamento do usuário logado
  fastify.post(
    "/check-budget",
    { preHandler: [authHook] },
    async (request, reply) => {
      try {
        await verificarAlertasOrcamento(request.user!.id);
        return reply.send({ success: true });
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em POST /alerts/check-budget");
        return reply.status(500).send({ success: false, error: "Erro ao verificar orçamento" });
      }
    }
  );

  // POST /alerts/weekly-summary - Envia resumo semanal ao usuário logado
  fastify.post(
    "/weekly-summary",
    { preHandler: [authHook] },
    async (request, reply) => {
      try {
        await enviarResumoSemanal(request.user!.id);
        return reply.send({ success: true });
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em POST /alerts/weekly-summary");
        return reply.status(500).send({ success: false, error: "Erro ao enviar resumo" });
      }
    }
  );

  // POST /alerts/run-all - (interno) roda alertas de orçamento e saldo de todos os usuários
  fastify.post(
    "/run-all",
    async (request, reply) => {
      if (!autorizadoInterno(request.headers["x-api-secret"])) {
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
          await verificarAlertasOrcamento(u.id);
          await verificarSaldoNegativo(u.id);
          processados++;
        } catch (e) {
          erros++;
          fastify.log.error({ err: e, userId: u.id }, "Erro ao rodar alertas");
        }
      }

      return reply.send({ processados, erros });
    }
  );

  // POST /alerts/weekly-all - (interno) envia resumo semanal de todos os usuários
  fastify.post(
    "/weekly-all",
    async (request, reply) => {
      if (!autorizadoInterno(request.headers["x-api-secret"])) {
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
          await enviarResumoSemanal(u.id);
          processados++;
        } catch (e) {
          erros++;
          fastify.log.error({ err: e, userId: u.id }, "Erro ao enviar resumo semanal");
        }
      }

      return reply.send({ processados, erros });
    }
  );
};

export { alertsRoutes };
export default alertsRoutes;
