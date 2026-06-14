"use client";

import { useState, useEffect, useCallback } from "react";
import { Sparkles, TrendingUp, AlertTriangle, Info, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Insight {
  tipo: "positivo" | "alerta" | "neutro";
  texto: string;
}

const ICONS = {
  positivo: { icon: TrendingUp, bg: "bg-green-50 dark:bg-green-900/20", color: "text-green-600 dark:text-green-400" },
  alerta: { icon: AlertTriangle, bg: "bg-amber-50 dark:bg-amber-900/20", color: "text-amber-600 dark:text-amber-400" },
  neutro: { icon: Info, bg: "bg-blue-50 dark:bg-blue-900/20", color: "text-blue-600 dark:text-blue-400" },
};

export function InsightsPanel() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
  const supabase = createClient();

  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const carregarInsights = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch(`${apiUrl}/insights`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      setInsights(json.insights || []);
    } catch (e) {
      console.error("Erro ao carregar insights:", e);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, supabase]);

  useEffect(() => {
    carregarInsights();
  }, [carregarInsights]);

  const atualizar = async () => {
    setRefreshing(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch(`${apiUrl}/insights/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      setInsights(json.insights || []);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-gray-100 dark:border-[#1E293B] shadow-[0_2px_10px_rgba(0,0,0,0.03)] p-6">
        <div className="h-4 w-40 bg-gray-100 dark:bg-[#1E293B] rounded animate-pulse mb-4" />
        <div className="space-y-3">
          <div className="h-10 bg-gray-50 dark:bg-[#1E293B] rounded-xl animate-pulse" />
          <div className="h-10 bg-gray-50 dark:bg-[#1E293B] rounded-xl animate-pulse" />
          <div className="h-10 bg-gray-50 dark:bg-[#1E293B] rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (insights.length === 0) return null;

  return (
    <div className="bg-white dark:bg-[#111827] rounded-2xl border border-gray-100 dark:border-[#1E293B] shadow-[0_2px_10px_rgba(0,0,0,0.03)] p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-green-600 dark:text-green-400" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-[#F8FAFC]">Insights Inteligentes</h3>
        </div>
        <button
          onClick={atualizar}
          disabled={refreshing}
          className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          title="Atualizar insights"
          aria-label="Atualizar insights"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="space-y-2.5">
        {insights.map((insight, i) => {
          const config = ICONS[insight.tipo] || ICONS.neutro;
          const Icon = config.icon;
          return (
            <div
              key={i}
              className="flex items-start gap-3 p-3 rounded-xl bg-gray-50/50 dark:bg-[#1E293B]/50 hover:bg-gray-50 dark:hover:bg-[#1E293B] transition-colors"
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${config.bg}`}
              >
                <Icon className={`w-3.5 h-3.5 ${config.color}`} />
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{insight.texto}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default InsightsPanel;
