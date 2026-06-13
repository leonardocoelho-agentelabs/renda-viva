"use client";

import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { createClient } from "@/lib/supabase/client";
import { TrendingUp, RefreshCw, Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Oportunidade {
  titulo: string;
  tipo: string;
  retornoAnual: string;
  risco: "baixo" | "medio" | "alto";
  valorMinimo: string;
  prazo: string;
  justificativa: string;
  ideal_para: string;
}

interface Mercado {
  selic: number;
  ipca: number;
  cdi: number;
  coletadoEm: string;
}

interface RadarData {
  oportunidades: Oportunidade[];
  mercado: Mercado;
}

const RISCO_BADGE: Record<string, string> = {
  baixo: "bg-green-50 text-green-700",
  medio: "bg-yellow-50 text-yellow-700",
  alto: "bg-red-50 text-red-700",
};

const RISCO_DOT: Record<string, string> = {
  baixo: "🟢",
  medio: "🟡",
  alto: "🔴",
};

export default function InvestmentsPage() {
  const supabase = createClient();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

  const [data, setData] = useState<RadarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getToken = useCallback(async (): Promise<string | null> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, [supabase]);

  const loadRadar = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const token = await getToken();
        if (!token) {
          setError("Sessão expirada. Faça login novamente.");
          return;
        }
        const res = await fetch(
          `${apiUrl}/investments/radar${refresh ? "?refresh=true" : ""}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) throw new Error(`Erro ${res.status}`);
        const json = await res.json();
        setData(json);
      } catch {
        setError("Não foi possível carregar o radar de investimentos.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [apiUrl, getToken]
  );

  useEffect(() => {
    loadRadar(false);
  }, [loadRadar]);

  const handleSendWhatsApp = async () => {
    setSending(true);
    setToast(null);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${apiUrl}/investments/radar/send-whatsapp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      setToast(json.enviado ? "Radar enviado por WhatsApp! ✅" : "Não foi possível enviar agora.");
    } catch {
      setToast("Erro ao enviar por WhatsApp.");
    } finally {
      setSending(false);
      setTimeout(() => setToast(null), 4000);
    }
  };

  const mercadoCards = data
    ? [
        { label: "Selic", value: `${data.mercado.selic}%`, sub: "ao ano" },
        { label: "IPCA", value: `${data.mercado.ipca}%`, sub: "ao mês" },
        { label: "CDI", value: `${data.mercado.cdi}%`, sub: "ao ano" },
      ]
    : [];

  return (
    <DashboardLayout>
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">Radar de Investimentos</h1>
            <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-green-50 text-green-700">
              Atualizado domingo
            </span>
          </div>
          <p className="text-gray-500">Curadoria semanal personalizada para o seu perfil</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => loadRadar(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            Atualizar Radar
          </button>
          <button
            onClick={handleSendWhatsApp}
            disabled={sending || loading || !data?.oportunidades.length}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="h-4 w-4" />
            {sending ? "Enviando..." : "Enviar por WhatsApp"}
          </button>
        </div>
      </div>

      {toast && (
        <div className="mb-6 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          {toast}
        </div>
      )}
      {error && (
        <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="h-10 w-10 rounded-full border-2 border-green-500 border-t-transparent animate-spin mb-4" />
          <p className="text-gray-400">Analisando o mercado e o seu perfil...</p>
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* Dados de mercado */}
          <div className="grid grid-cols-3 gap-4">
            {mercadoCards.map((c) => (
              <div
                key={c.label}
                className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"
              >
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {c.label}
                </span>
                <p className="text-2xl font-bold text-gray-900 mt-2">{c.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
              </div>
            ))}
          </div>

          {/* Oportunidades */}
          {data.oportunidades.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-xl border border-gray-100 shadow-sm">
              <TrendingUp className="h-12 w-12 text-gray-300 mb-3" />
              <p className="text-gray-500">Nenhuma recomendação disponível no momento.</p>
              <p className="text-sm text-gray-400 mt-1">Tente atualizar o radar em instantes.</p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              {data.oportunidades.map((op, i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <span className="text-xs font-medium text-gray-400">{op.tipo}</span>
                      <h3 className="font-semibold text-gray-900 leading-tight">{op.titulo}</h3>
                    </div>
                    <span
                      className={cn(
                        "text-xs font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap",
                        RISCO_BADGE[op.risco] || RISCO_BADGE.medio
                      )}
                    >
                      {RISCO_DOT[op.risco] || "🟡"} {op.risco}
                    </span>
                  </div>

                  <p className="text-2xl font-bold text-green-600">{op.retornoAnual}</p>

                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-2 mb-3">
                    <span>💰 {op.valorMinimo}</span>
                    <span>⏱️ {op.prazo}</span>
                  </div>

                  <p className="text-sm text-gray-600 flex-1">{op.justificativa}</p>

                  {op.ideal_para && (
                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <span className="inline-block text-xs font-medium px-2.5 py-1 rounded-lg bg-green-50 text-green-700">
                        ✨ Ideal para você
                      </span>
                      <p className="text-xs text-gray-500 mt-1.5">{op.ideal_para}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-gray-400 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Curadoria gerada por IA com base em dados do Banco Central e Tesouro Direto. Não é
            recomendação de investimento.
          </p>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
