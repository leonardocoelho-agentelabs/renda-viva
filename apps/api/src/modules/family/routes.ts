import type { FastifyInstance } from "fastify";
import { FamilyService } from "./service.js";

export async function familyRoutes(fastify: FastifyInstance) {
  // Buscar família do usuário logado
  fastify.get(
    "/family",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const service = new FamilyService(fastify.supabaseAdmin);
        const result = await service.getFamilyByUser(userId);
        if (!result) return reply.send({ family: null });
        return reply.send(result);
      } catch (error: any) {
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Criar família + convidar membro
  fastify.post(
    "/family",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const { nome_membro, email_membro, whatsapp_membro } = request.body as any;

        if (!nome_membro || !email_membro || !whatsapp_membro) {
          return reply
            .status(400)
            .send({ error: "Nome, email e WhatsApp do membro são obrigatórios" });
        }

        // Buscar nome do titular
        const { data: owner } = await fastify.supabaseAdmin
          .from("users")
          .select("full_name")
          .eq("id", userId)
          .maybeSingle();

        const service = new FamilyService(fastify.supabaseAdmin);
        const result = await service.createFamilyAndInvite(
          userId,
          owner?.full_name || "Família",
          { nome: nome_membro, email: email_membro, whatsapp: whatsapp_membro }
        );

        return reply.status(201).send(result);
      } catch (error: any) {
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // Convidar membro para família existente
  fastify.post(
    "/family/invite",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const { nome_membro, email_membro, whatsapp_membro } = request.body as any;

        if (!nome_membro || !email_membro || !whatsapp_membro) {
          return reply
            .status(400)
            .send({ error: "Nome, email e WhatsApp do membro são obrigatórios" });
        }

        const service = new FamilyService(fastify.supabaseAdmin);
        const result = await service.inviteMember(userId, {
          nome: nome_membro,
          email: email_membro,
          whatsapp: whatsapp_membro,
        });

        return reply.status(201).send(result);
      } catch (error: any) {
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // Validar token de convite (rota pública)
  fastify.get("/family/invite/:token", async (request, reply) => {
    try {
      const { token } = request.params as any;
      const service = new FamilyService(fastify.supabaseAdmin);
      const invite = await service.validateInviteToken(token);
      if (!invite) return reply.status(404).send({ error: "Convite inválido ou expirado" });
      return reply.send({ invite });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Aceitar convite
  fastify.post(
    "/family/invite/:token/accept",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const { token } = request.params as any;
        const service = new FamilyService(fastify.supabaseAdmin);
        const result = await service.acceptInvite(token, userId);
        return reply.send(result);
      } catch (error: any) {
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // Remover membro
  fastify.delete(
    "/family/members/:memberId",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const { memberId } = request.params as any;
        const service = new FamilyService(fastify.supabaseAdmin);
        await service.removeMember(userId, memberId);
        return reply.send({ success: true });
      } catch (error: any) {
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // Dashboard familiar
  fastify.get(
    "/family/dashboard",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const service = new FamilyService(fastify.supabaseAdmin);
        const dashboard = await service.getFamilyDashboard(userId);
        return reply.send(dashboard);
      } catch (error: any) {
        return reply.status(500).send({ error: error.message });
      }
    }
  );
}
