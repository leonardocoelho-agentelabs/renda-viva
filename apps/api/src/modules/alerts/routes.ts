import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { authHook, requireActiveSubscription } from "../../plugins/auth.js";
import { supabaseAdmin } from "../../plugins/supabase.js";
import { enviarMensagemWhatsApp } from "../../services/whatsapp.service.js";
import {
  verificarAlertasOrcamento,
  verificarSaldoNegativo,
  enviarResumoSemanal,
} from "../../services/alerts.service.js";

const API_SECRET = process.env.API_SECRET || "internal-secret-key";

function autorizadoInterno(secret: unknown): boolean {
  return secret === API_SECRET;
}

async function getNumerosWhatsAppUsuario(userId: string): Promise<string[]> {
  const { data: contatos } = await supabaseAdmin
    .from('whatsapp_contacts')
    .select('telefone')
    .eq('user_id', userId)

  if (!contatos || contatos.length === 0) return [];

  return contatos.map(c => `55${c.telefone}`);
}

const alertsRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // POST /alerts/test - Mensagem de teste para validar a integração com os números do usuário
  fastify.post(
    "/test",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      const userId = request.user!.id;
      const numeros = await getNumerosWhatsAppUsuario(userId);

      if (numeros.length === 0) {
        return reply.send({ enviado: false, erro: "Nenhum número WhatsApp cadastrado" });
      }

      const mensagem = "🎉 *Renda Viva* — Integração WhatsApp funcionando! Seus alertas financeiros estão ativos.";
      const results = await Promise.all(
        numeros.map(numero =>
          enviarMensagemWhatsApp(numero, mensagem).catch(() => false)
        )
      );

      return reply.send({ enviado: results.some(r => r === true), numerosEnviados: numeros.length });
    }
  );

  // POST /alerts/check-budget - Verifica alertas de orçamento do usuário logado
  fastify.post(
    "/check-budget",
    { preHandler: [authHook, requireActiveSubscription] },
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
    { preHandler: [authHook, requireActiveSubscription] },
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
