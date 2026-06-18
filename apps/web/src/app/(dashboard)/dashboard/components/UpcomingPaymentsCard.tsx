"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { CalendarDays, AlertCircle, Check } from "lucide-react";
import Link from "next/link";

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

interface UpcomingData {
  eventos: UpcomingEvent[];
  proximos_7_dias: UpcomingEvent[];
  total_proximos_7_dias: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function getRelativeDay(dias_restantes: number): string {
  if (dias_restantes === 0) return "Hoje";
  if (dias_restantes === 1) return "Amanhã";
  return `Em ${dias_restantes}d`;
}

export function UpcomingPaymentsCard() {
  const supabase = createClient();
  const [data, setData] = useState<UpcomingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [payingIds, setPayingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        const response = await fetch("/api/calendar/proximos-30-dias", {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });

        if (response.ok) {
          const result = await response.json();
          setData(result);
        }
      } catch (err) {
        console.error("Erro ao buscar próximos pagamentos:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [supabase]);

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
        setData(prev => {
          if (!prev) return prev;
          const newProximos = prev.proximos_7_dias.filter(e => e.id !== eventId);
          const newEventos = prev.eventos.filter(e => e.id !== eventId);
          const total = newProximos.reduce((sum, e) => sum + (e.valor < 0 ? Math.abs(e.valor) : 0), 0);
          return {
            ...prev,
            proximos_7_dias: newProximos,
            eventos: newEventos,
            total_proximos_7_dias: Math.round(total * 100) / 100
          };
        });
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

  if (loading) {
    return (
      <Card className="bg-white dark:bg-[#1E1E1E] border border-gray-100 dark:border-white/8">
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-5 bg-gray-200 dark:bg-white/10 rounded w-1/2 mb-3"></div>
            <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-2/4"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.proximos_7_dias.length === 0) {
    return null;
  }

  return (
    <Card className="bg-white dark:bg-[#1E1E1E] border border-gray-100 dark:border-white/8">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-rv-forest dark:text-rv-vivid" />
            <h3 className="font-semibold text-rv-ink dark:text-[#F0F0F0]">
              Próximos vencimentos
            </h3>
          </div>
          <Link
            href="/calendario"
            className="text-sm text-rv-green hover:text-rv-forest dark:text-rv-vivid"
          >
            Ver calendário →
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Lista de próximos eventos */}
        <div className="space-y-2">
          {data.proximos_7_dias.slice(0, 5).map((event) => (
            <div
              key={event.id}
              className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-white/5 last:border-0"
            >
              <div className="flex items-center gap-3">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: event.cor }}
                />
                <div>
                  <p className="text-sm font-medium text-rv-ink dark:text-[#F0F0F0]">
                    {event.titulo}
                  </p>
                  <p className="text-xs text-[#8A8A8A]">
                    {getRelativeDay(event.dias_restantes)}
                    {event.categoria && ` · ${event.categoria}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-semibold ${event.valor < 0 ? "text-red-600" : "text-green-600"}`}>
                  {formatCurrency(event.valor)}
                </span>
                {!event.pago && (
                  <button
                    onClick={() => handleMarkAsPaid(event.id)}
                    disabled={payingIds.has(event.id)}
                    className="flex items-center gap-1 bg-rv-mint/50 dark:bg-rv-green/20 text-rv-forest dark:text-rv-vivid rounded-lg px-2 py-1 text-xs font-medium hover:bg-rv-green hover:text-white transition-colors disabled:opacity-50"
                  >
                    {payingIds.has(event.id) ? (
                      <div className="w-3 h-3 border border-rv-green border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Check className="w-3 h-3" />
                        Pagar
                      </>
                    )}
                  </button>
                )}
                {event.dias_restantes <= 2 && !event.pago && (
                  <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="pt-3 mt-3 border-t border-gray-100 dark:border-white/5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#8A8A8A]">
              Total nos próximos 7 dias:
            </span>
            <span className="text-lg font-bold text-red-600">
              {formatCurrency(data.total_proximos_7_dias)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
