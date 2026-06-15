import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import Anthropic from "@anthropic-ai/sdk";
import { authHook, requireActiveSubscription } from "../../plugins/auth.js";
import { env } from "../../env.js";

const anthropic = new Anthropic({ apiKey: env.CLAUDE_API_KEY });

interface AiBudget {
  categoria: string;
  limite: number;
  tipo?: string;
  justificativa?: string;
  alerta?: unknown;
}

function mesAtualStr(): string {
  return new Date().toISOString().slice(0, 7); // ex.: '2026-06'
}

function intervaloMes(mesAno: string): { inicio: string; fim: string } {
  const [ano, mes] = mesAno.split("-").map((v) => parseInt(v, 10));
  const inicio = `${mesAno}-01`;
  const fim = new Date(ano, mes, 0).toISOString().split("T")[0]; // último dia do mês
  return { inicio, fim };
}

// O Claude às vezes envolve o JSON em ```json ... ``` e adiciona comentários
// depois do array. Extrai o array de forma robusta cobrindo esses casos.
function extractJsonFromResponse(text: string): AiBudget[] {
  // 1. JSON dentro de bloco ```json ... ```
  const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    try {
      return JSON.parse(jsonBlockMatch[1].trim());
    } catch {
      // continua
    }
  }

  // 2. Primeiro array JSON encontrado no texto
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0]);
    } catch {
      // continua
    }
  }

  // 3. Limpa cercas de markdown e corta após o último ']'
  try {
    const clean = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const endIndex = clean.lastIndexOf("]");
    if (endIndex !== -1) {
      return JSON.parse(clean.substring(0, endIndex + 1));
    }
  } catch {
    // continua
  }

  throw new Error("Não foi possível extrair JSON válido da resposta");
}

const budgetRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // POST /budget/generate - Gera (ou retorna existente) orçamento do mês atual
  fastify.post(
    "/generate",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const supabase = fastify.supabaseAdmin;
        const mesAtual = mesAtualStr();

        // 1. Já existe orçamento para este mês?
        const { data: existente } = await supabase
          .from("budgets")
          .select("*")
          .eq("user_id", userId)
          .eq("mes_ano", mesAtual);

        if (existente && existente.length > 0) {
          return reply.send({
            budgets: existente,
            gerado: false,
            mensagem: "Orçamento já existe para este mês",
          });
        }

        // 2. Histórico dos últimos 3 meses (apenas débitos)
        const tresM = new Date();
        tresM.setMonth(tresM.getMonth() - 3);
        const inicioHistorico = tresM.toISOString().split("T")[0];

        const { data: historico } = await supabase
          .from("transactions")
          .select("categoria, valor")
          .eq("user_id", userId)
          .lt("valor", 0)
          .gte("data", inicioHistorico);

        // 3. Média mensal por categoria
        const porCategoria: Record<string, number[]> = {};
        (historico || []).forEach((t) => {
          const cat = t.categoria || "Outros";
          if (!porCategoria[cat]) porCategoria[cat] = [];
          porCategoria[cat].push(Math.abs(Number(t.valor)));
        });

        const mediasPorCategoria = Object.entries(porCategoria).map(
          ([cat, valores]) => ({
            categoria: cat,
            media_mensal: valores.reduce((a, b) => a + b, 0) / 3,
          })
        );

        // 4. Renda do usuário
        const { data: perfil } = await supabase
          .from("users")
          .select("renda_mensal")
          .eq("id", userId)
          .single();

        // 5. Claude gera o orçamento
        const prompt = `Você é um consultor financeiro pessoal. Com base no histórico de gastos do usuário,
gere um orçamento mensal seguindo a regra 50/30/20 adaptada.

RENDA MENSAL DECLARADA: R$ ${Number(perfil?.renda_mensal || 0)}

MÉDIA DE GASTOS DOS ÚLTIMOS 3 MESES POR CATEGORIA:
${
          mediasPorCategoria.length > 0
            ? mediasPorCategoria
                .map((c) => `- ${c.categoria}: R$ ${c.media_mensal.toFixed(2)}/mês`)
                .join("\n")
            : "Sem histórico de gastos."
        }

REGRA 50/30/20:
- Necessidades (50%): Moradia, Alimentação, Saúde, Transporte
- Desejos (30%): Lazer, Educação, Outros
- Poupança/Investimentos (20%): Investimentos, Reserva

Retorne SOMENTE um JSON válido com array de orçamentos:
[
  {
    "categoria": "Alimentação",
    "limite": 800.00,
    "tipo": "necessidade",
    "justificativa": "Baseado na média de R$ 750/mês + 7% de margem"
  }
]

Inclua todas as categorias do histórico mais as categorias padrão que o usuário ainda não usa.
Seja realista baseado no histórico real, não apenas na regra teórica.`;

        const response = await anthropic.messages.create({
          model: "claude-haiku-4-5",
          max_tokens: 2048,
          messages: [{ role: "user", content: prompt }],
        });

        const first = response.content[0];
        const responseText = first && first.type === "text" ? first.text : "[]";

        let orcamentosIA: AiBudget[];
        try {
          orcamentosIA = extractJsonFromResponse(responseText);
        } catch (parseErr) {
          fastify.log.error(
            { err: parseErr, responseText },
            "Falha ao parsear JSON do orçamento gerado"
          );
          return reply.status(502).send({
            success: false,
            error: "Não foi possível gerar o orçamento. Tente novamente.",
          });
        }

        if (!Array.isArray(orcamentosIA)) {
          return reply.status(502).send({
            success: false,
            error: "Não foi possível gerar o orçamento. Tente novamente.",
          });
        }

        // Filtrar apenas itens válidos (com categoria e limite numérico, sem alertas)
        const orcamentosValidos = orcamentosIA.filter(
          (o) => o && o.categoria && typeof o.limite === "number" && !o.alerta
        );

        if (orcamentosValidos.length === 0) {
          return reply.status(502).send({
            success: false,
            error: "IA não retornou orçamentos válidos",
          });
        }

        // 6. Dedupe por categoria (constraint unique) e prepara insert
        const vistos = new Set<string>();
        const orcamentosParaInserir = orcamentosValidos
          .filter((o) => {
            const key = o.categoria.trim();
            if (vistos.has(key)) return false;
            vistos.add(key);
            return true;
          })
          .map((o) => ({
            user_id: userId,
            mes_ano: mesAtual,
            categoria: o.categoria.trim(),
            limite: o.limite,
            gasto_atual: 0,
            status: "sugerido",
          }));

        const { data: inseridos, error: insertError } = await supabase
          .from("budgets")
          .insert(orcamentosParaInserir)
          .select();

        if (insertError) {
          fastify.log.error({ err: insertError }, "Erro ao inserir orçamentos");
          return reply.status(500).send({
            success: false,
            error: "Erro ao salvar o orçamento gerado",
          });
        }

        return reply.send({
          budgets: inseridos,
          gerado: true,
          mensagem: `Orçamento gerado com ${inseridos?.length || 0} categorias`,
        });
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em POST /budget/generate");
        return reply.status(500).send({
          success: false,
          error: "Erro ao gerar orçamento",
        });
      }
    }
  );

  // GET /budget/current - Orçamento do mês com gasto_atual recalculado
  fastify.get(
    "/current",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const supabase = fastify.supabaseAdmin;
        const mesAtual = mesAtualStr();
        const { inicio: inicioMes, fim: fimMes } = intervaloMes(mesAtual);

        const { data: budgets } = await supabase
          .from("budgets")
          .select("*")
          .eq("user_id", userId)
          .eq("mes_ano", mesAtual)
          .order("categoria", { ascending: true });

        if (!budgets || budgets.length === 0) {
          return reply.send({ budgets: [], mes_ano: mesAtual, existe: false });
        }

        // Gastos reais por categoria no mês
        const { data: transacoes } = await supabase
          .from("transactions")
          .select("categoria, valor")
          .eq("user_id", userId)
          .lt("valor", 0)
          .gte("data", inicioMes)
          .lte("data", fimMes);

        const gastosPorCategoria: Record<string, number> = {};
        (transacoes || []).forEach((t) => {
          const cat = t.categoria || "Outros";
          gastosPorCategoria[cat] =
            (gastosPorCategoria[cat] || 0) + Math.abs(Number(t.valor));
        });

        const budgetsAtualizados = await Promise.all(
          budgets.map(async (b) => {
            const gastoReal = gastosPorCategoria[b.categoria] || 0;
            await supabase
              .from("budgets")
              .update({ gasto_atual: gastoReal })
              .eq("id", b.id);
            return { ...b, gasto_atual: gastoReal };
          })
        );

        return reply.send({
          budgets: budgetsAtualizados,
          mes_ano: mesAtual,
          existe: true,
        });
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em GET /budget/current");
        return reply.status(500).send({
          success: false,
          error: "Erro ao buscar orçamento",
        });
      }
    }
  );

  // PATCH /budget/:id/approve - Aprova um orçamento sugerido
  fastify.patch<{ Params: { id: string } }>(
    "/:id/approve",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const { id } = request.params;

        const { data: atualizado, error } = await fastify.supabaseAdmin
          .from("budgets")
          .update({ status: "aprovado" })
          .eq("id", id)
          .eq("user_id", userId)
          .select()
          .single();

        if (error || !atualizado) {
          return reply.status(404).send({
            success: false,
            error: "Orçamento não encontrado",
          });
        }

        return reply.send({ success: true, budget: atualizado });
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em PATCH /budget/:id/approve");
        return reply.status(500).send({
          success: false,
          error: "Erro ao aprovar orçamento",
        });
      }
    }
  );

  // PATCH /budget/:id/limit - Atualiza o limite de um orçamento
  fastify.patch<{ Params: { id: string }; Body: { limite: number } }>(
    "/:id/limit",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const { id } = request.params;
        const { limite } = request.body || {};

        if (typeof limite !== "number" || limite < 0 || !Number.isFinite(limite)) {
          return reply.status(400).send({
            success: false,
            error: "Limite inválido",
          });
        }

        const { data: atualizado, error } = await fastify.supabaseAdmin
          .from("budgets")
          .update({ limite })
          .eq("id", id)
          .eq("user_id", userId)
          .select()
          .single();

        if (error || !atualizado) {
          return reply.status(404).send({
            success: false,
            error: "Orçamento não encontrado",
          });
        }

        return reply.send({ success: true, budget: atualizado });
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em PATCH /budget/:id/limit");
        return reply.status(500).send({
          success: false,
          error: "Erro ao atualizar limite",
        });
      }
    }
  );
};

export { budgetRoutes };
export default budgetRoutes;
