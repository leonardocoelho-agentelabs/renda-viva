"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { ChevronLeft, ChevronRight, Check, X, AlertCircle } from "lucide-react";
import Link from "next/link";

interface CalendarEvent {
  id: string;
  titulo: string;
  tipo: string;
  valor?: number;
  pago: boolean;
  pago_em?: string;
  cor: string;
  recurring_commitment_id?: string;
  goal_id?: string;
  categoria?: string;
  descricao?: string;
}

interface CalendarDay {
  date: string;
  events: CalendarEvent[];
}

interface CalendarData {
  mes: string;
  resumo: {
    total_entradas_previstas: number;
    total_saidas_previstas: number;
    saldo_previsto: number;
    total_compromissos: number;
    compromissos_pagos: number;
    compromissos_pendentes: number;
  };
  dias: Record<string, CalendarEvent[]>;
}

interface UpcomingEvent {
  id: string;
  titulo: string;
  tipo: string;
  valor: number;
  data: string;
  pago: boolean;
  cor: string;
  categoria?: string;
  dias_restantes: number;
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const DAYS_OF_WEEK = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isToday(year: number, month: number, day: number): boolean {
  const today = new Date();
  return (
    today.getFullYear() === year &&
    today.getMonth() === month &&
    today.getDate() === day
  );
}

function isPast(year: number, month: number, day: number): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(year, month, day);
  return date < today;
}

function getRelativeDay(dias_restantes: number): string {
  if (dias_restantes === 0) return "Hoje";
  if (dias_restantes === 1) return "Amanhã";
  return `Em ${dias_restantes}d`;
}

export default function CalendarioPage() {
  const supabase = createClient();
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<{ date: string; events: CalendarEvent[] } | null>(null);
  const [payingIds, setPayingIds] = useState<Set<string>>(new Set());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const fetchCalendarData = useCallback(async () => {
    setLoading(true);
    try {
      const monthStr = String(month + 1).padStart(2, "0");
      const [calendarRes, upcomingRes] = await Promise.all([
        supabase.auth.getSession(),
        Promise.resolve(null)
      ]);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const token = session.access_token;

      const [calendarResponse, upcomingResponse] = await Promise.all([
        fetch(`/api/calendar/${year}/${monthStr}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch("/api/calendar/proximos-30-dias", {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (calendarResponse.ok) {
        const data = await calendarResponse.json();
        setCalendarData(data);
      }

      if (upcomingResponse.ok) {
        const data = await upcomingResponse.json();
        setUpcomingEvents(data.proximos_7_dias || []);
      }
    } catch (error) {
      console.error("Erro ao buscar dados do calendário:", error);
    } finally {
      setLoading(false);
    }
  }, [year, month, supabase]);

  useEffect(() => {
    fetchCalendarData();
  }, [fetchCalendarData]);

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDay(null);
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDay(null);
  };

  const handleMarkAsPaid = async (eventId: string) => {
    setPayingIds(prev => new Set(prev).add(eventId));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/calendar/${eventId}/pagar`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      if (response.ok) {
        // Atualizar estado local
        if (selectedDay) {
          setSelectedDay({
            ...selectedDay,
            events: selectedDay.events.map(e =>
              e.id === eventId ? { ...e, pago: true } : e
            )
          });
        }

        // Atualizar calendário principal
        if (calendarData) {
          const newDias = { ...calendarData.dias };
          for (const date in newDias) {
            newDias[date] = newDias[date].map(e =>
              e.id === eventId ? { ...e, pago: true } : e
            );
          }
          setCalendarData({ ...calendarData, dias: newDias });
        }

        // Remover da lista de próximos se mudou
        setUpcomingEvents(prev => prev.filter(e => e.id !== eventId));
      }
    } catch (error) {
      console.error("Erro ao marcar como pago:", error);
    } finally {
      setPayingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(eventId);
        return newSet;
      });
    }
  };

  const renderCalendarGrid = () => {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const days: (number | null)[] = [];

    // Preencher dias vazios no início
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    // Preencher dias do mês
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    const weeks: (number | null)[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }

    // Preencher última semana se necessário
    const lastWeek = weeks[weeks.length - 1];
    while (lastWeek.length < 7) {
      lastWeek.push(null);
    }

    return weeks.map((week, weekIndex) => (
      <tr key={weekIndex}>
        {week.map((day, dayIndex) => {
          if (day === null) {
            return <td key={dayIndex} className="border-r border-b border-rv-forest/5 dark:border-white/5 p-1 min-h-[100px]" />;
          }

          const dateStr = formatDateString(year, month, day);
          const dayEvents = calendarData?.dias[dateStr] || [];
          const today = isToday(year, month, day);
          const past = isPast(year, month, day);

          return (
            <td
              key={dayIndex}
              className={`
                border-r border-b border-rv-forest/5 dark:border-white/5 p-1 min-h-[100px] align-top
                hover:bg-rv-mint/20 dark:hover:bg-white/5 cursor-pointer transition-colors
                ${today ? "ring-2 ring-rv-green dark:ring-rv-vivid bg-rv-mint/30 dark:bg-rv-green/10" : ""}
                ${past ? "opacity-60" : ""}
              `}
              onClick={() => dayEvents.length > 0 && setSelectedDay({ date: dateStr, events: dayEvents })}
            >
              <div className={`text-sm font-medium mb-1 ${today ? "text-rv-green dark:text-rv-vivid font-bold" : ""}`}>
                {day}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((event, idx) => (
                  <div
                    key={idx}
                    className={`
                      rounded-full px-1.5 py-0.5 text-xs truncate
                      ${event.pago ? "line-through opacity-50" : ""}
                    `}
                    style={{ backgroundColor: `${event.cor}20`, color: event.cor }}
                  >
                    <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: event.cor }} />
                    {event.titulo}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-rv-forest/60 dark:text-white/50 pl-1">
                    +{dayEvents.length - 3} mais
                  </div>
                )}
              </div>
            </td>
          );
        })}
      </tr>
    ));
  };

  return (
    <div className="min-h-screen bg-rv-page dark:bg-rv-dark-bg">
      {/* Cabeçalho */}
      <div className="bg-white dark:bg-rv-dark-card border-b border-rv-forest/10 dark:border-white/8 px-6 py-6">
        <h1 className="text-2xl font-bold text-rv-forest dark:text-white">
          📅 Calendário Financeiro
        </h1>
        <p className="text-rv-forest/60 dark:text-white/50 mt-1">
          Veja tudo que vai entrar e sair nos próximos dias.
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* Cards de resumo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-rv-dark-card border border-rv-forest/10 dark:border-white/8 rounded-2xl p-4">
            <p className="text-sm text-rv-forest/60 dark:text-white/50">Entradas Previstas</p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {calendarData ? formatCurrency(calendarData.resumo.total_entradas_previstas) : "R$ 0,00"}
            </p>
          </div>
          <div className="bg-white dark:bg-rv-dark-card border border-rv-forest/10 dark:border-white/8 rounded-2xl p-4">
            <p className="text-sm text-rv-forest/60 dark:text-white/50">Saídas Previstas</p>
            <p className="text-2xl font-bold text-red-600 mt-1">
              {calendarData ? formatCurrency(calendarData.resumo.total_saidas_previstas) : "R$ 0,00"}
            </p>
          </div>
          <div className="bg-white dark:bg-rv-dark-card border border-rv-forest/10 dark:border-white/8 rounded-2xl p-4">
            <p className="text-sm text-rv-forest/60 dark:text-white/50">Saldo Previsto</p>
            <p className={`text-2xl font-bold mt-1 ${(calendarData?.resumo.saldo_previsto || 0) >= 0 ? "text-rv-green" : "text-red-600"}`}>
              {calendarData ? formatCurrency(calendarData.resumo.saldo_previsto) : "R$ 0,00"}
            </p>
          </div>
          <div className="bg-white dark:bg-rv-dark-card border border-rv-forest/10 dark:border-white/8 rounded-2xl p-4">
            <p className="text-sm text-rv-forest/60 dark:text-white/50">Pendentes</p>
            <p className="text-2xl font-bold text-orange-500 mt-1">
              {calendarData?.resumo.compromissos_pendentes || 0} items
            </p>
          </div>
        </div>

        {/* Navegação de mês e Calendário */}
        <div className="bg-white dark:bg-rv-dark-card border border-rv-forest/10 dark:border-white/8 rounded-2xl overflow-hidden">
          {/* Navegação */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-rv-forest/5 dark:border-white/5">
            <button
              onClick={goToPreviousMonth}
              className="p-2 hover:bg-rv-mint/20 dark:hover:bg-white/5 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-rv-forest dark:text-white" />
            </button>
            <h2 className="text-lg font-semibold text-rv-forest dark:text-white">
              {MONTHS[month]} {year}
            </h2>
            <button
              onClick={goToNextMonth}
              className="p-2 hover:bg-rv-mint/20 dark:hover:bg-white/5 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-rv-forest dark:text-white" />
            </button>
          </div>

          {/* Calendário */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rv-green" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-rv-mint/10 dark:bg-white/5">
                    {DAYS_OF_WEEK.map((day) => (
                      <th key={day} className="py-3 text-xs font-semibold text-rv-forest/60 dark:text-white/50 uppercase">
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {renderCalendarGrid()}
                </tbody>
              </table>
            </div>
          )}

          {/* Legenda */}
          <div className="px-6 py-4 border-t border-rv-forest/5 dark:border-white/5 flex flex-wrap gap-4">
            <div className="flex items-center gap-2 text-xs text-rv-forest/60 dark:text-white/50">
              <span className="w-3 h-3 rounded-full bg-red-500" />
              Vencimento
            </div>
            <div className="flex items-center gap-2 text-xs text-rv-forest/60 dark:text-white/50">
              <span className="w-3 h-3 rounded-full bg-green-500" />
              Receita
            </div>
            <div className="flex items-center gap-2 text-xs text-rv-forest/60 dark:text-white/50">
              <span className="w-3 h-3 rounded-full bg-blue-500" />
              Meta
            </div>
            <div className="flex items-center gap-2 text-xs text-rv-forest/60 dark:text-white/50">
              <span className="w-3 h-3 rounded-full bg-yellow-500" />
              Previsto
            </div>
            <div className="flex items-center gap-2 text-xs text-rv-forest/60 dark:text-white/50">
              <span className="w-3 h-3 rounded-full bg-gray-400" />
              Pago
            </div>
          </div>
        </div>

        {/* Próximos vencimentos */}
        <div className="bg-white dark:bg-rv-dark-card border border-rv-forest/10 dark:border-white/8 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-rv-forest/5 dark:border-white/5 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-rv-forest dark:text-white flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-500" />
              Próximos vencimentos (7 dias)
            </h3>
            <Link
              href="/dashboard"
              className="text-sm text-rv-green hover:underline"
            >
              Ver calendário →
            </Link>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-rv-green" />
            </div>
          ) : upcomingEvents.length === 0 ? (
            <div className="px-6 py-12 text-center text-rv-forest/50 dark:text-white/40">
              Nenhum vencimento nos próximos 7 dias
            </div>
          ) : (
            <div className="divide-y divide-rv-forest/5 dark:divide-white/5">
              {upcomingEvents.map((event) => (
                <div
                  key={event.id}
                  className="px-6 py-4 flex items-center justify-between hover:bg-rv-mint/10 dark:hover:bg-white/5"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: event.cor }}
                    />
                    <div>
                      <p className="font-medium text-rv-forest dark:text-white">
                        {event.titulo}
                      </p>
                      <p className="text-sm text-rv-forest/50 dark:text-white/40">
                        {getRelativeDay(event.dias_restantes)}
                        {event.categoria && ` · ${event.categoria}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`font-semibold ${event.valor < 0 ? "text-red-600" : "text-green-600"}`}>
                      {formatCurrency(event.valor)}
                    </span>
                    {!event.pago && (
                      <button
                        onClick={() => handleMarkAsPaid(event.id)}
                        disabled={payingIds.has(event.id)}
                        className="bg-rv-mint dark:bg-rv-green/20 text-rv-forest dark:text-rv-vivid border border-rv-forest/15 rounded-lg px-3 py-1 text-xs font-semibold hover:bg-rv-green hover:text-white transition-colors disabled:opacity-50"
                      >
                        {payingIds.has(event.id) ? (
                          <div className="w-4 h-4 border-2 border-rv-green border-t-transparent rounded-full animate-spin" />
                        ) : (
                          "Pagar"
                        )}
                      </button>
                    )}
                    {event.pago && (
                      <span className="flex items-center gap-1 text-green-600 text-sm">
                        <Check className="w-4 h-4" /> Pago
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de eventos do dia */}
      {selectedDay && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-end"
          onClick={() => setSelectedDay(null)}
        >
          <div
            className="bg-white dark:bg-rv-dark-card w-full max-w-md h-full overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white dark:bg-rv-dark-card border-b border-rv-forest/10 dark:border-white/8 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-rv-forest dark:text-white">
                  Eventos de {new Date(selectedDay.date + "T00:00:00").toLocaleDateString("pt-BR", {
                    day: "numeric",
                    month: "long"
                  })}
                </h3>
                <p className="text-sm text-rv-forest/50 dark:text-white/40">
                  {selectedDay.events.length} evento(s)
                </p>
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                className="p-2 hover:bg-rv-mint/20 dark:hover:bg-white/5 rounded-lg"
              >
                <X className="w-5 h-5 text-rv-forest dark:text-white" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {selectedDay.events.map((event) => (
                <div
                  key={event.id}
                  className={`
                    border rounded-xl p-4
                    ${event.pago
                      ? "border-gray-200 dark:border-white/10 opacity-60"
                      : "border-rv-forest/10 dark:border-white/8"
                    }
                  `}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: event.cor }}
                      />
                      <span className={`font-semibold text-rv-forest dark:text-white ${event.pago ? "line-through" : ""}`}>
                        {event.titulo}
                      </span>
                    </div>
                    <span className={`
                      text-xs px-2 py-0.5 rounded-full
                      ${event.pago
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                        : "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400"
                      }
                    `}>
                      {event.pago ? "PAGO" : "PENDENTE"}
                    </span>
                  </div>

                  <div className="text-sm text-rv-forest/60 dark:text-white/50 mb-3">
                    {event.categoria && <span>{event.categoria} · </span>}
                    {event.descricao && <span>{event.descricao}</span>}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className={`text-lg font-bold ${event.valor && event.valor < 0 ? "text-red-600" : "text-green-600"}`}>
                      {event.valor ? formatCurrency(event.valor) : "—"}
                    </span>

                    {!event.pago && (
                      <button
                        onClick={() => handleMarkAsPaid(event.id)}
                        disabled={payingIds.has(event.id)}
                        className="flex items-center gap-2 bg-rv-mint dark:bg-rv-green/20 text-rv-forest dark:text-rv-vivid border border-rv-forest/15 rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-rv-green hover:text-white transition-colors disabled:opacity-50"
                      >
                        {payingIds.has(event.id) ? (
                          <div className="w-4 h-4 border-2 border-rv-green border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            Pagar
                          </>
                        )}
                      </button>
                    )}

                    {event.pago && (
                      <span className="flex items-center gap-1 text-green-600 text-sm">
                        <Check className="w-4 h-4" />
                        Pago em {event.pago_em ? new Date(event.pago_em).toLocaleDateString("pt-BR") : "—"}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
