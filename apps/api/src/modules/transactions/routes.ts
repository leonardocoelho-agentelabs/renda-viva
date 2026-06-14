import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { authHook } from "../../plugins/auth.js";

const CATEGORIAS_PADRAO = [
  "Alimentação",
  "Transporte",
  "Saúde",
  "Educação",
  "Lazer",
  "Moradia",
  "Investimentos",
  "Receita",
  "Assinaturas",
  "Outros",
];

type TipoEntrada = "despesa" | "receita";

interface CreateBody {
  data: string;
  valor: number;
  descricao_raw: string;
  categoria: string;
  tipo: TipoEntrada;
}

interface UpdateBody {
  data?: string;
  valor?: number;
  descricao_raw?: string;
  categoria?: string;
  tipo?: TipoEntrada;
}

// Mapeia o tipo de entrada (despesa/receita) para a coluna `tipo` da tabela
function tipoColuna(tipo: TipoEntrada): "debito" | "credito" {
  return tipo === "despesa" ? "debito" : "credito";
}

function valorComSinal(valor: number, tipo: TipoEntrada): number {
  const abs = Math.abs(valor);
  return tipo === "despesa" ? -abs : abs;
}

async function recalcularScore(userId: string): Promise<void> {
  try {
    const { calcularScore } = await import("../score/service.js");
    await calcularScore(userId);
  } catch (e) {
    console.error("[Transactions] Erro ao recalcular score:", e);
  }
}

const transactionsRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // GET /transactions/categories - categorias padrão + as já usadas pelo usuário
  fastify.get(
    "/categories",
    { preHandler: [authHook] },
    async (request, reply) => {
      const { data: usadas } = await fastify.supabaseAdmin
        .from("transactions")
        .select("categoria")
        .eq("user_id", request.user!.id)
        .not("categoria", "is", null);

      const categoriasUsadas = [
        ...new Set((usadas || []).map((t) => t.categoria as string)),
      ];
      const categorias = [
        ...new Set([...CATEGORIAS_PADRAO, ...categoriasUsadas]),
      ].sort();

      return reply.send({ categorias });
    }
  );

  // POST /transactions - cria transação manual
  fastify.post<{ Body: CreateBody }>(
    "/",
    { preHandler: [authHook] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const body = request.body;

        if (
          !body?.data ||
          !body?.descricao_raw?.trim() ||
          typeof body.valor !== "number" ||
          !Number.isFinite(body.valor) ||
          (body.tipo !== "despesa" && body.tipo !== "receita")
        ) {
          return reply.status(400).send({
            success: false,
            error: "Dados inválidos. Informe data, descrição, valor e tipo.",
          });
        }

        const { data: criada, error } = await fastify.supabaseAdmin
          .from("transactions")
          .insert({
            user_id: userId,
            data: body.data,
            valor: valorComSinal(body.valor, body.tipo),
            descricao_raw: body.descricao_raw.trim(),
            categoria: body.categoria || null,
            tipo: tipoColuna(body.tipo),
            origem: "manual",
            status_revisao: "aprovado",
            score_confianca: 1.0,
          })
          .select()
          .single();

        if (error || !criada) {
          fastify.log.error({ err: error }, "Erro ao criar transação");
          return reply.status(500).send({ success: false, error: "Erro ao criar transação" });
        }

        await recalcularScore(userId);
        return reply.status(201).send({ transaction: criada });
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em POST /transactions");
        return reply.status(500).send({ success: false, error: "Erro ao criar transação" });
      }
    }
  );

  // PATCH /transactions/:id - edita transação
  fastify.patch<{ Params: { id: string }; Body: UpdateBody }>(
    "/:id",
    { preHandler: [authHook] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const { id } = request.params;
        const body = request.body || {};

        // Verifica propriedade e pega o estado atual
        const { data: atual } = await fastify.supabaseAdmin
          .from("transactions")
          .select("valor")
          .eq("id", id)
          .eq("user_id", userId)
          .single();

        if (!atual) {
          return reply.status(404).send({ success: false, error: "Transação não encontrada" });
        }

        const update: Record<string, unknown> = {};
        if (body.data !== undefined) update.data = body.data;
        if (body.descricao_raw !== undefined) update.descricao_raw = body.descricao_raw.trim();
        if (body.categoria !== undefined) update.categoria = body.categoria || null;

        // Tipo efetivo: o enviado, ou o derivado do sinal atual
        const tipoEfetivo: TipoEntrada =
          body.tipo ?? (Number(atual.valor) < 0 ? "despesa" : "receita");

        if (body.tipo !== undefined) {
          update.tipo = tipoColuna(tipoEfetivo);
        }

        // Recalcula o valor com sinal quando valor e/ou tipo mudam
        if (body.valor !== undefined) {
          update.valor = valorComSinal(body.valor, tipoEfetivo);
        } else if (body.tipo !== undefined) {
          update.valor = valorComSinal(Math.abs(Number(atual.valor)), tipoEfetivo);
        }

        const { data: atualizada, error } = await fastify.supabaseAdmin
          .from("transactions")
          .update(update)
          .eq("id", id)
          .eq("user_id", userId)
          .select()
          .single();

        if (error || !atualizada) {
          return reply.status(500).send({ success: false, error: "Erro ao atualizar transação" });
        }

        await recalcularScore(userId);
        return reply.send({ transaction: atualizada });
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em PATCH /transactions/:id");
        return reply.status(500).send({ success: false, error: "Erro ao atualizar transação" });
      }
    }
  );

  // DELETE /transactions/:id - remove transação
  fastify.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [authHook] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const { id } = request.params;

        const { data: existente } = await fastify.supabaseAdmin
          .from("transactions")
          .select("id")
          .eq("id", id)
          .eq("user_id", userId)
          .single();

        if (!existente) {
          return reply.status(404).send({ success: false, error: "Transação não encontrada" });
        }

        const { error } = await fastify.supabaseAdmin
          .from("transactions")
          .delete()
          .eq("id", id)
          .eq("user_id", userId);

        if (error) {
          return reply.status(500).send({ success: false, error: "Erro ao deletar transação" });
        }

        await recalcularScore(userId);
        return reply.send({ success: true });
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em DELETE /transactions/:id");
        return reply.status(500).send({ success: false, error: "Erro ao deletar transação" });
      }
    }
  );
};

export { transactionsRoutes };
export default transactionsRoutes;
