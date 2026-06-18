import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { authHook, requireActiveSubscription } from "../../plugins/auth.js";

interface CalendarEvent {
  id: string;
  user_id: string;
  titulo: string;
  descricao?: string;
  tipo: "vencimento_recorrente" | "transacao_prevista" | "salario" | "meta_aporte" | "alerta";
  valor?: number;
  data_evento: string;
  recurring_commitment_id?: string;
  goal_id?: string;
  pago: boolean;
  pago_em?: string;
  created_at: string;
}

interface RecurringCommitment {
  id: string;
  nome: string;
  descricao?: string;
  categoria: string;
  tipo: "assinatura" | "parcela";
  valor: number;
  dia_vencimento: number;
  total_parcelas?: number;
  parcelas_pagas?: number;
  status: "ativo" | "inativo" | "cancelado";
  data_inicio?: string;
  data_fim?: string;
  created_at: string;
}

interface Goal {
  id: string;
  nome: string;
  aporte_mensal?: number;
  prazo?: string;
  status: "ativo" | "inativo" | "concluido";
}

interface Transaction {
  id: string;
  data: string;
  valor: number;
  descricao_raw?: string;
  categoria?: string;
  tipo: "entrada" | "saida";
}

// Helper para obter o último dia do mês
function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

// Helper para formatar data YYYY-MM-DD
function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Helper para calcular dia válido do vencimento
function getValidDay(year: number, month: number, day: number): number {
  const lastDay = getLastDayOfMonth(year, month);
  return Math.min(day, lastDay);
}

// Helper para obter cor baseada no tipo
function getColorForTipo(tipo: string): string {
  const colors: Record<string, string> = {
    vencimento_recorrente: "#EF4444",
    salario: "#52B788",
    transacao_prevista: "#F59E0B",
    meta_aporte: "#3B82F6",
    alerta: "#8B5CF6",
  };
  return colors[tipo] || "#9CA3AF";
}

// Detectar receitas recorrentes (salário) baseado em transações passadas
async function detectRecurringIncome(
  supabase: any,
  userId: string,
  year: number,
  month: number
): Promise<Array<{ titulo: string; valor: number; dia: number }>> {
  const recurringIncome: Array<{ titulo: string; valor: number; dia: number }> = [];

  // Buscar transações dos últimos 6 meses para detectar padrões
  const startDate = new Date(year, month - 6, 1).toISOString().split("T")[0];
  const endDate = new Date(year, month, 0).toISOString().split("T")[0];

  const { data: transactions } = await supabase
    .from("transactions")
    .select("data, valor, descricao_raw, tipo")
    .eq("user_id", userId)
    .eq("tipo", "entrada")
    .gte("data", startDate)
    .lte("data", endDate)
    .gte("valor", 500); // Apenas transações >= R$500

  if (!transactions || transactions.length === 0) return [];

  // Agrupar transações por descrição similar e dia do mês
  const grouped: Record<string, Array<{ data: string; valor: number }>> = {};

  for (const tx of transactions as Transaction[]) {
    const desc = (tx.descricao_raw || "Receita").trim().substring(0, 30);
    if (!grouped[desc]) grouped[desc] = [];
    grouped[desc].push({ data: tx.data, valor: tx.valor });
  }

  // Verificar quais grupos aparecem todo mês
  for (const [desc, txs] of Object.entries(grouped)) {
    if (txs.length < 2) continue;

    // Verificar se as transações ocorrem em meses diferentes com dias similares
    const monthsSeen = new Map<string, { day: number; valor: number }>();

    for (const tx of txs) {
      const txDate = new Date(tx.data);
      const txMonth = txDate.getMonth();
      const txYear = txDate.getFullYear();
      const key = `${txYear}-${txMonth}`;

      if (!monthsSeen.has(key)) {
        monthsSeen.set(key, { day: txDate.getDate(), valor: tx.valor });
      }
    }

    // Se apareceu em pelo menos 3 meses diferentes com dias próximos, é salário
    if (monthsSeen.size >= 3) {
      const entries = Array.from(monthsSeen.values());
      const avgDay = Math.round(entries.reduce((sum, e) => sum + e.day, 0) / entries.length);
      const avgValor = entries.reduce((sum, e) => sum + e.valor, 0) / entries.length;

      // Verificar se os dias estão próximos (±3 dias)
      const dayVariance = Math.max(...entries.map((e) => e.day)) - Math.min(...entries.map((e) => e.day));
      if (dayVariance <= 3) {
        recurringIncome.push({
          titulo: desc.includes("salário") || desc.includes("salario") ? "Salário" : desc,
          valor: Math.round(avgValor * 100) / 100,
          dia: avgDay,
        });
      }
    }
  }

  return recurringIncome;
}

const calendarRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // GET /api/calendar/:ano/:mes - Retorna todos os eventos do mês
  fastify.get<{ Params: { ano: string; mes: string } }>(
    "/:ano/:mes",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const { ano, mes } = request.params;
        const year = parseInt(ano);
        const month = parseInt(mes);

        if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
          return reply.status(400).send({ success: false, error: "Mês ou ano inválido" });
        }

        const supabase = fastify.supabase;
        const lastDay = getLastDayOfMonth(year, month);
        const startDate = formatDate(year, month, 1);
        const endDate = formatDate(year, month, lastDay);

        // 1. Buscar eventos da tabela calendar_events
        const { data: events } = await supabase
          .from("calendar_events")
          .select("*")
          .eq("user_id", userId)
          .gte("data_evento", startDate)
          .lte("data_evento", endDate)
          .order("data_evento", { ascending: true });

        // 2. Buscar compromissos recorrentes ativos
        const { data: recurring } = await supabase
          .from("recurring_commitments")
          .select("*")
          .eq("user_id", userId)
          .eq("status", "ativo");

        // 3. Buscar transações reais do mês
        const { data: transactions } = await supabase
          .from("transactions")
          .select("data, valor, descricao_raw, categoria, tipo")
          .eq("user_id", userId)
          .gte("data", startDate)
          .lte("data", endDate);

        // 4. Detectar receitas recorrentes
        const recurringIncome = await detectRecurringIncome(supabase, userId, year, month);

        // 5. Buscar metas com aporte mensal
        const { data: goals } = await supabase
          .from("goals")
          .select("id, nome, aporte_mensal, prazo, status")
          .eq("user_id", userId)
          .eq("status", "ativo")
          .not("aporte_mensal", "is", null);

        // Montar estrutura de dias
        const dias: Record<string, any[]> = {};

        // Inicializar todos os dias do mês
        for (let day = 1; day <= lastDay; day++) {
          const dateKey = formatDate(year, month, day);
          dias[dateKey] = [];
        }

        // Adicionar eventos existentes
        if (events) {
          for (const event of events as CalendarEvent[]) {
            if (!dias[event.data_evento]) {
              dias[event.data_evento] = [];
            }
            dias[event.data_evento].push({
              id: event.id,
              titulo: event.titulo,
              tipo: event.tipo,
              valor: event.valor,
              pago: event.pago,
              pago_em: event.pago_em,
              cor: getColorForTipo(event.tipo),
              recurring_commitment_id: event.recurring_commitment_id,
              goal_id: event.goal_id,
              descricao: event.descricao,
            });
          }
        }

        // Gerar eventos dinâmicos de compromissos recorrentes
        if (recurring) {
          for (const r of recurring as RecurringCommitment[]) {
            const validDay = getValidDay(year, month, r.dia_vencimento);
            const dateKey = formatDate(year, month, validDay);

            // Verificar se já existe evento para este compromisso neste dia
            const existing = (events as CalendarEvent[] || []).find(
              (e) => e.recurring_commitment_id === r.id && e.data_evento === dateKey
            );

            if (!existing) {
              dias[dateKey].push({
                id: `rc-${r.id}-${dateKey}`,
                titulo: r.nome,
                tipo: "vencimento_recorrente",
                valor: -r.valor, // Valores de despesa são negativos
                pago: false,
                cor: "#EF4444",
                recurring_commitment_id: r.id,
                categoria: r.categoria,
                descricao:
                  r.tipo === "parcela" && r.total_parcelas
                    ? `${r.parcelas_pagas || 0}/${r.total_parcelas} parcelas`
                    : r.descricao,
              });
            }
          }
        }

        // Adicionar receitas recorrentes detectadas
        for (const income of recurringIncome) {
          const validDay = getValidDay(year, month, income.dia);
          const dateKey = formatDate(year, month, validDay);

          dias[dateKey].push({
            id: `salario-${dateKey}`,
            titulo: income.titulo,
            tipo: "salario",
            valor: income.valor,
            pago: false,
            cor: "#52B788",
            descricao: "Receita recorrente detectada",
          });
        }

        // Adicionar aportes de metas
        if (goals) {
          for (const goal of goals as Goal[]) {
            if (goal.aporte_mensal && goal.aporte_mensal > 0) {
              // Buscar aporte já realizado no mês
              const aporteRealizado = (transactions as Transaction[] || []).filter(
                (t) =>
                  t.descricao_raw?.toLowerCase().includes(goal.nome.toLowerCase()) ||
                  t.categoria?.toLowerCase().includes("meta")
              );

              // Adicionar aporte previsto (assumindo dia 1 ou 5)
              const goalDay = 5;
              const dateKey = formatDate(year, month, goalDay);

              dias[dateKey].push({
                id: `meta-${goal.id}`,
                titulo: `Aporte: ${goal.nome}`,
                tipo: "meta_aporte",
                valor: goal.aporte_mensal,
                pago: aporteRealizado.length > 0,
                cor: "#3B82F6",
                goal_id: goal.id,
                descricao: `Meta mensal: ${goal.nome}`,
              });
            }
          }
        }

        // Calcular resumo
        let totalEntradas = 0;
        let totalSaidas = 0;
        let compromissosPagos = 0;
        let compromissosPendentes = 0;

        const allEvents = Object.values(dias).flat();

        for (const event of allEvents) {
          if (event.tipo === "vencimento_recorrente" || event.tipo === "meta_aporte") {
            if (event.valor < 0) {
              totalSaidas += Math.abs(event.valor);
            }
            if (event.pago) {
              compromissosPagos++;
            } else {
              compromissosPendentes++;
            }
          } else if (event.tipo === "salario" || event.valor > 0) {
            totalEntradas += event.valor;
          }
        }

        return reply.send({
          mes: `${ano}-${String(month).padStart(2, "0")}`,
          resumo: {
            total_entradas_previstas: Math.round(totalEntradas * 100) / 100,
            total_saidas_previstas: Math.round(totalSaidas * 100) / 100,
            saldo_previsto: Math.round((totalEntradas - totalSaidas) * 100) / 100,
            total_compromissos: compromissosPagos + compromissosPendentes,
            compromissos_pagos: compromissosPagos,
            compromissos_pendentes: compromissosPendentes,
          },
          dias,
        });
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em GET /api/calendar/:ano/:mes");
        return reply.status(500).send({ success: false, error: "Erro ao buscar calendário" });
      }
    }
  );

  // GET /api/calendar/proximos-30-dias - Próximos 30 dias para o dashboard
  fastify.get(
    "/proximos-30-dias",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const supabase = fastify.supabase;

        const today = new Date();
        const thirtyDaysLater = new Date(today);
        thirtyDaysLater.setDate(today.getDate() + 30);

        const startDate = today.toISOString().split("T")[0];
        const endDate = thirtyDaysLater.toISOString().split("T")[0];

        // Buscar compromissos recorrentes
        const { data: recurring } = await supabase
          .from("recurring_commitments")
          .select("*")
          .eq("user_id", userId)
          .eq("status", "ativo");

        const events: any[] = [];

        // Gerar eventos para os próximos 30 dias
        if (recurring) {
          for (const r of recurring as RecurringCommitment[]) {
            const currentDate = new Date(today);

            for (let i = 0; i < 30; i++) {
              if (currentDate > thirtyDaysLater) break;

              const dayOfMonth = currentDate.getDate();
              if (dayOfMonth === r.dia_vencimento) {
                const dateStr = currentDate.toISOString().split("T")[0];
                events.push({
                  id: `rc-${r.id}-${dateStr}`,
                  titulo: r.nome,
                  tipo: "vencimento_recorrente",
                  valor: -r.valor,
                  data: dateStr,
                  pago: false,
                  cor: "#EF4444",
                  categoria: r.categoria,
                  dias_restantes: i,
                });
              }
              currentDate.setDate(currentDate.getDate() + 1);
            }
          }
        }

        // Ordenar por data
        events.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());

        // Filtrar apenas os próximos 7 dias para a lista compacta
        const proximos7dias = events.slice(0, 7);

        // Calcular total dos próximos 7 dias
        const totalProximos7Dias = proximos7dias.reduce(
          (sum, e) => sum + (e.valor < 0 ? Math.abs(e.valor) : 0),
          0
        );

        return reply.send({
          eventos: events.slice(0, 10), // Máximo 10 eventos
          proximos_7_dias: proximos7dias,
          total_proximos_7_dias: Math.round(totalProximos7Dias * 100) / 100,
        });
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em GET /api/calendar/proximos-30-dias");
        return reply.status(500).send({ success: false, error: "Erro ao buscar próximos eventos" });
      }
    }
  );

  // PATCH /api/calendar/:eventId/pagar - Marcar evento como pago
  fastify.patch<{ Params: { eventId: string } }>(
    "/:eventId/pagar",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const { eventId } = request.params;
        const supabase = fastify.supabase;

        // Se é um evento de recurring_commitment, atualizar lá também
        if (eventId.startsWith("rc-")) {
          const parts = eventId.split("-");
          const commitmentId = parts[1];

          // Atualizar parcelas_pagas no recurring_commitments
          const { data: commitment } = await supabase
            .from("recurring_commitments")
            .select("id, tipo, parcelas_pagas, total_parcelas")
            .eq("id", commitmentId)
            .eq("user_id", userId)
            .single();

          if (commitment) {
            const newParcelasPagas = (commitment.parcelas_pagas || 0) + 1;

            // Se for parcela e atingiu o total, marcar como inativo
            if (commitment.tipo === "parcela" && commitment.total_parcelas) {
              if (newParcelasPagas >= commitment.total_parcelas) {
                await supabase
                  .from("recurring_commitments")
                  .update({ status: "inativo" })
                  .eq("id", commitmentId);
              }
            }

            // Atualizar parcelas_pagas
            await supabase
              .from("recurring_commitments")
              .update({ parcelas_pagas: newParcelasPagas })
              .eq("id", commitmentId);
          }

          return reply.send({
            success: true,
            message: "Pagamento registrado",
            parcelas_pagas: newParcelasPagas,
          });
        }

        // Para eventos normais da tabela calendar_events
        const { data: event } = await supabase
          .from("calendar_events")
          .select("id, recurring_commitment_id")
          .eq("id", eventId)
          .eq("user_id", userId)
          .single();

        if (!event) {
          return reply.status(404).send({ success: false, error: "Evento não encontrado" });
        }

        const { data: updated } = await supabase
          .from("calendar_events")
          .update({ pago: true, pago_em: new Date().toISOString() })
          .eq("id", eventId)
          .select()
          .single();

        // Se tem recurring_commitment_id, atualizar lá também
        if (event.recurring_commitment_id) {
          const { data: commitment } = await supabase
            .from("recurring_commitments")
            .select("parcelas_pagas, total_parcelas, tipo")
            .eq("id", event.recurring_commitment_id)
            .single();

          if (commitment) {
            const newParcelasPagas = (commitment.parcelas_pagas || 0) + 1;

            if (commitment.tipo === "parcela" && commitment.total_parcelas) {
              if (newParcelasPagas >= commitment.total_parcelas) {
                await supabase
                  .from("recurring_commitments")
                  .update({ status: "inativo", parcelas_pagas: newParcelasPagas })
                  .eq("id", event.recurring_commitment_id);
              } else {
                await supabase
                  .from("recurring_commitments")
                  .update({ parcelas_pagas: newParcelasPagas })
                  .eq("id", event.recurring_commitment_id);
              }
            } else {
              await supabase
                .from("recurring_commitments")
                .update({ parcelas_pagas: newParcelasPagas })
                .eq("id", event.recurring_commitment_id);
            }
          }
        }

        return reply.send({ success: true, event: updated });
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em PATCH /api/calendar/:eventId/pagar");
        return reply.status(500).send({ success: false, error: "Erro ao marcar como pago" });
      }
    }
  );

  // POST /api/calendar/sincronizar - Gerar/atualizar eventos automáticos
  fastify.post(
    "/sincronizar",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const supabase = fastify.supabase;

        const today = new Date();
        const threeMonthsLater = new Date(today);
        threeMonthsLater.setMonth(today.getMonth() + 3);

        let synced = 0;

        // Buscar compromissos recorrentes ativos
        const { data: recurring } = await supabase
          .from("recurring_commitments")
          .select("*")
          .eq("user_id", userId)
          .eq("status", "ativo");

        if (recurring) {
          for (const r of recurring as RecurringCommitment[]) {
            const currentDate = new Date(today);

            while (currentDate <= threeMonthsLater) {
              const dayOfMonth = currentDate.getDate();
              const year = currentDate.getFullYear();
              const month = currentDate.getMonth() + 1;
              const validDay = getValidDay(year, month, r.dia_vencimento);
              const dateStr = formatDate(year, month, validDay);

              // Verificar se já existe
              const { data: existing } = await supabase
                .from("calendar_events")
                .select("id")
                .eq("user_id", userId)
                .eq("recurring_commitment_id", r.id)
                .eq("data_evento", dateStr)
                .single();

              if (!existing) {
                // Criar evento
                await supabase.from("calendar_events").insert({
                  user_id: userId,
                  titulo: r.nome,
                  descricao: r.descricao,
                  tipo: "vencimento_recorrente",
                  valor: r.valor,
                  data_evento: dateStr,
                  recurring_commitment_id: r.id,
                  pago: false,
                });
                synced++;
              }

              // Avançar para o próximo mês
              currentDate.setMonth(currentDate.getMonth() + 1);
              currentDate.setDate(1);
            }
          }
        }

        // Buscar metas com aporte
        const { data: goals } = await supabase
          .from("goals")
          .select("*")
          .eq("user_id", userId)
          .eq("status", "ativo")
          .not("aporte_mensal", "is", null);

        if (goals) {
          for (const goal of goals as Goal[]) {
            if (!goal.aporte_mensal || goal.aporte_mensal <= 0) continue;

            const currentDate = new Date(today);

            while (currentDate <= threeMonthsLater) {
              const year = currentDate.getFullYear();
              const month = currentDate.getMonth() + 1;
              const dateStr = formatDate(year, month, 5); // Dia 5 do mês

              const { data: existing } = await supabase
                .from("calendar_events")
                .select("id")
                .eq("user_id", userId)
                .eq("goal_id", goal.id)
                .eq("data_evento", dateStr)
                .single();

              if (!existing) {
                await supabase.from("calendar_events").insert({
                  user_id: userId,
                  titulo: `Aporte: ${goal.nome}`,
                  descricao: `Meta mensal: ${goal.nome}`,
                  tipo: "meta_aporte",
                  valor: goal.aporte_mensal,
                  data_evento: dateStr,
                  goal_id: goal.id,
                  pago: false,
                });
                synced++;
              }

              currentDate.setMonth(currentDate.getMonth() + 1);
            }
          }
        }

        return reply.send({
          success: true,
          message: `${synced} eventos sincronizados`,
          synced,
        });
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em POST /api/calendar/sincronizar");
        return reply.status(500).send({ success: false, error: "Erro ao sincronizar calendário" });
      }
    }
  );
};

export { calendarRoutes };
export default calendarRoutes;
