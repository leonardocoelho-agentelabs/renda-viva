"use client";

import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { createClient } from "@/lib/supabase/client";
import { Heart, RefreshCw, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

interface Dimensao {
  nome: string;
  pontos: number;
  max: number;
  descricao: string;
}

interface ScoreData {
  score: number;
  dimensoes: Dimensao[];
}

function scoreColor(score: number): string {
  if (score >= 70) return "text-green-600";
  if (score >= 40) return "text-yellow-600";
  return "text-red-600";
}

function scoreRingColor(score: number): string {
  if (score >= 70) return "#16a34a";
  if (score >= 40) return "#ca8a04";
  return "#dc2626";
}

function scoreLabel(score: number): string {
  if (score >= 70) return "Saúde excelente";
  if (score >= 40) return "Em desenvolvimento";
  return "Atenção necessária";
}

function barColor(pct: number): string {
  if (pct >= 0.7) return "bg-green-500";
  if (pct >= 0.4) return "bg-yellow-500";
  return "bg-red-500";
}

function ScoreRing({ score }: { score: number }) {
  const radius = 70;
  const stroke = 12;
  const normalizedRadius = radius - stroke / 2;
  const circumference = 2 * Math.PI * normalizedRadius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative" style={{ width: radius * 2, height: radius * 2 }}>
      <svg height={radius * 2} width={radius * 2} className="-rotate-90">
        <circle
          stroke="#e5e7eb"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        <circle
          stroke={scoreRingColor(score)}
          fill="transparent"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          style={{ strokeDashoffset: offset, transition: "stroke-dashoffset 0.6s ease" }}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-4xl font-bold", scoreColor(score))}>{score}</span>
        <span className="text-xs text-gray-400">de 100</span>
      </div>
    </div>
  );
}

export default function ScorePage() {
  const supabase = createClient();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

  const [data, setData] = useState<ScoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getToken = useCallback(async (): Promise<string | null> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, [supabase]);

  const fetchScore = useCallback(
    async (method: "GET" | "POST") => {
      const token = await getToken();
      if (!token) {
        setError("Sessão expirada. Faça login novamente.");
        return;
      }
      const res = await fetch(
        `${apiUrl}/score/${method === "POST" ? "calculate" : "current"}`,
        {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
          },
          ...(method === "POST" ? { body: JSON.stringify({}) } : {}),
        }
      );
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const json = await res.json();
      setData(json);
    },
    [apiUrl, getToken]
  );

  useEffect(() => {
    setLoading(true);
    fetchScore("GET")
      .catch(() => setError("Não foi possível carregar seu score."))
      .finally(() => setLoading(false));
  }, [fetchScore]);

  const handleRecalculate = async () => {
    setRecalculating(true);
    setError(null);
    try {
      await fetchScore("POST");
    } catch {
      setError("Não foi possível recalcular o score.");
    } finally {
      setRecalculating(false);
    }
  };

  // Dimensão com menor aproveitamento (para a dica personalizada)
  const piorDimensao = data?.dimensoes.length
    ? [...data.dimensoes].sort((a, b) => a.pontos / a.max - b.pontos / b.max)[0]
    : null;

  return (
    <DashboardLayout>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Score de Saúde Financeira</h1>
          <p className="text-gray-500">Uma nota de 0 a 100 sobre a sua saúde financeira</p>
        </div>
        <button
          onClick={handleRecalculate}
          disabled={recalculating || loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={cn("h-4 w-4", recalculating && "animate-spin")} />
          {recalculating ? "Recalculando..." : "Recalcular Score"}
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="h-10 w-10 rounded-full border-2 border-green-500 border-t-transparent animate-spin mb-4" />
          <p className="text-gray-400">Calculando seu score...</p>
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* Score geral */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex flex-col sm:flex-row items-center gap-6">
            <ScoreRing score={data.score} />
            <div className="text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                <Heart className={cn("h-5 w-5", scoreColor(data.score))} />
                <span className={cn("text-lg font-semibold", scoreColor(data.score))}>
                  {scoreLabel(data.score)}
                </span>
              </div>
              <p className="text-sm text-gray-500 max-w-md">
                Seu score é calculado a partir de 6 dimensões da sua vida financeira.
                Quanto mais completo e saudável seu histórico, maior a nota.
              </p>
            </div>
          </div>

          {/* Dica personalizada */}
          {piorDimensao && piorDimensao.pontos < piorDimensao.max && (
            <div className="flex gap-3 rounded-xl bg-amber-50 border border-amber-100 p-4">
              <Lightbulb className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  Onde você mais pode melhorar: {piorDimensao.nome}
                </p>
                <p className="text-sm text-amber-700 mt-0.5">{piorDimensao.descricao}</p>
              </div>
            </div>
          )}

          {/* Dimensões */}
          <div className="grid gap-4 sm:grid-cols-2">
            {data.dimensoes.map((dim) => {
              const pct = dim.max > 0 ? dim.pontos / dim.max : 0;
              return (
                <div
                  key={dim.nome}
                  className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">{dim.nome}</h3>
                    <span className="text-sm font-semibold text-gray-600">
                      {dim.pontos}
                      <span className="text-gray-400">/{dim.max}</span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden mb-3">
                    <div
                      className={cn("h-full rounded-full transition-all", barColor(pct))}
                      style={{ width: `${pct * 100}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-500">{dim.descricao}</p>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
