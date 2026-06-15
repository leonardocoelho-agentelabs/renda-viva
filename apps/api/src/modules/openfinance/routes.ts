import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { authHook, requireActiveSubscription } from "../../plugins/auth.js";
import { criarConnectToken, buscarItem } from "../../services/pluggy.service.js";
import { sincronizarItem } from "../../services/openfinance.service.js";

interface ConnectBody {
  itemId: string;
}

interface WebhookBody {
  event?: string;
  itemId?: string;
  // Pluggy também pode enviar o id em "id" dependendo do evento
  id?: string;
}

const openfinanceRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // POST /openfinance/connect-token - Token para abrir o widget Pluggy
  fastify.post(
    "/connect-token",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const connectToken = await criarConnectToken(request.user!.id);
        return reply.send({ connectToken });
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em POST /openfinance/connect-token");
        return reply.status(500).send({
          success: false,
          error: "Erro ao criar token de conexão",
        });
      }
    }
  );

  // POST /openfinance/connections - Salva a conexão após o widget (onSuccess) e sincroniza
  fastify.post<{ Body: ConnectBody }>(
    "/connections",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const itemId = request.body?.itemId;
        if (!itemId) {
          return reply.status(400).send({ success: false, error: "itemId é obrigatório" });
        }

        const item = await buscarItem(itemId);
        const institutionName = item.institution?.name || "Banco";
        const institutionLogo = item.institution?.imageUrl || null;

        const { data: connection, error } = await fastify.supabaseAdmin
          .from("bank_connections")
          .upsert(
            {
              user_id: userId,
              pluggy_item_id: itemId,
              institution_name: institutionName,
              institution_logo: institutionLogo,
              status: "active",
            },
            { onConflict: "user_id,pluggy_item_id" }
          )
          .select()
          .single();

        if (error) {
          fastify.log.error({ err: error }, "Erro ao salvar conexão");
          return reply.status(500).send({ success: false, error: "Erro ao salvar conexão" });
        }

        // Sincronização inicial (best-effort, não bloqueia o retorno em caso de falha)
        let importadas = 0;
        try {
          importadas = await sincronizarItem(userId, itemId);
        } catch (e) {
          fastify.log.error({ err: e }, "Erro na sincronização inicial");
        }

        return reply.send({ connection, importadas });
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em POST /openfinance/connections");
        return reply.status(500).send({
          success: false,
          error: "Erro ao conectar banco",
        });
      }
    }
  );

  // GET /openfinance/connections - Lista as conexões do usuário
  fastify.get(
    "/connections",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      const { data, error } = await fastify.supabaseAdmin
        .from("bank_connections")
        .select("id, pluggy_item_id, institution_name, institution_logo, status, last_sync_at, created_at")
        .eq("user_id", request.user!.id)
        .order("created_at", { ascending: false });

      if (error) {
        return reply.status(500).send({ success: false, error: "Erro ao listar conexões" });
      }
      return reply.send(data || []);
    }
  );

  // DELETE /openfinance/connections/:id - Desconecta um banco
  fastify.delete<{ Params: { id: string } }>(
    "/connections/:id",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      const { error } = await fastify.supabaseAdmin
        .from("bank_connections")
        .delete()
        .eq("id", request.params.id)
        .eq("user_id", request.user!.id);

      if (error) {
        return reply.status(500).send({ success: false, error: "Erro ao desconectar" });
      }
      return reply.send({ success: true });
    }
  );

  // POST /openfinance/sync/:itemId - Sincronização manual
  fastify.post<{ Params: { itemId: string } }>(
    "/sync/:itemId",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const itemId = request.params.itemId;

        // Garante que o item pertence ao usuário
        const { data: conn } = await fastify.supabaseAdmin
          .from("bank_connections")
          .select("id")
          .eq("user_id", userId)
          .eq("pluggy_item_id", itemId)
          .single();

        if (!conn) {
          return reply.status(404).send({ success: false, error: "Conexão não encontrada" });
        }

        const importadas = await sincronizarItem(userId, itemId);
        return reply.send({ success: true, importadas });
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em POST /openfinance/sync");
        return reply.status(500).send({ success: false, error: "Erro ao sincronizar" });
      }
    }
  );

  // POST /openfinance/webhook - Chamado pela Pluggy (sem JWT)
  fastify.post<{ Body: WebhookBody }>(
    "/webhook",
    async (request, reply) => {
      const body = request.body || {};
      const event = body.event || "";
      const itemId = body.itemId || body.id;

      // Responde rápido; o processamento pesado roda em background.
      reply.send({ received: true });

      if (!itemId) return;

      try {
        // Mapeia item -> usuário (só agimos sobre itens já conhecidos)
        const { data: conn } = await fastify.supabaseAdmin
          .from("bank_connections")
          .select("user_id")
          .eq("pluggy_item_id", itemId)
          .maybeSingle();

        if (!conn) {
          fastify.log.warn({ itemId, event }, "Webhook Pluggy para item desconhecido");
          return;
        }

        const userId = conn.user_id as string;

        if (event === "item/error") {
          await fastify.supabaseAdmin
            .from("bank_connections")
            .update({ status: "error" })
            .eq("pluggy_item_id", itemId);
          return;
        }

        // item/created, item/updated, transactions/created -> sincroniza
        if (
          event === "item/created" ||
          event === "item/updated" ||
          event.startsWith("transactions/")
        ) {
          await fastify.supabaseAdmin
            .from("bank_connections")
            .update({ status: "updating" })
            .eq("pluggy_item_id", itemId);

          await sincronizarItem(userId, itemId).catch((e) =>
            fastify.log.error({ err: e, itemId }, "Erro ao sincronizar via webhook")
          );
        }
      } catch (e) {
        fastify.log.error({ err: e, itemId, event }, "Erro no webhook Pluggy");
      }
    }
  );
};

export { openfinanceRoutes };
export default openfinanceRoutes;
