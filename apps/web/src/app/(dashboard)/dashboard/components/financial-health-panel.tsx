"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Heart, Check, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { SCORE_DIMENSION_LABELS, getScoreClassificacao } from "@/lib/score-labels";

interface Dimensao {
  nome: string;
  pontos: number;
  max: number;
  descricao?: string;
}

export function FinancialHealthPanel() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
  const supabase = createClient();

  const [score, setScore] = useState<number | null>(null);
  const [dimensoes, setDimensoes] = useState<Dimensao[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch(`${apiUrl}/score/current`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      setScore(json.score ?? 0);
      setDimensoes(json.dimensoes || []);
    } catch (e) {
      console.error("Erro ao carregar score:", e);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, supabase]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-white/8 shadow-[0_2px_10px_rgba(0,0,0,0.03)] p-6">
        <div className="h-4 w-40 bg-gray-100 dark:bg-[#2A2A2A] rounded animate-pulse mb-4" />
        <div className="h-8 w-24 bg-gray-100 dark:bg-[#2A2A2A] rounded animate-pulse mb-4" />
        <div className="space-y-2">
          <div className="h-6 bg-gray-50 dark:bg-[#2A2A2A] rounded animate-pulse" />
          <div className="h-6 bg-gray-50 dark:bg-[#2A2A2A] rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (score === null) return null;

  const classificacao = getScoreClassificacao(score);

  // Pontos fracos primeiro (mais relevante), depois os fortes
  const ordenadas = [...dimensoes].sort((a, b) => a.pontos / a.max - b.pontos / b.max);

  return (
    <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-white/8 shadow-[0_2px_10px_rgba(0,0,0,0.03)] p-6">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Heart className="w-4 h-4 text-pink-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-[#F0F0F0]">Saúde Financeira</h3>
        </div>
        <Link href="/score" className="text-xs text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 font-medium">
          Ver detalhes
        </Link>
      </div>

      <div className="flex items-baseline gap-2 mb-4 mt-2">
        <span className="text-3xl font-bold text-gray-900 dark:text-[#F0F0F0]">{score}</span>
        <span className="text-sm text-[#8A8A8A]">/100</span>
        <span className={`text-sm font-medium ${classificacao.cor}`}>
          — {classificacao.label}
        </span>
      </div>

      <div className="space-y-2">
        {ordenadas.map((dim, i) => {
          const ratio = dim.max > 0 ? dim.pontos / dim.max : 0;
          const isBom = ratio >= 0.7;
          const labels = SCORE_DIMENSION_LABELS[dim.nome];
          const texto = labels ? (isBom ? labels.positivo : labels.atencao) : dim.nome;

          return (
            <div key={i} className="flex items-center gap-2.5">
              {isBom ? (
                <div className="w-5 h-5 rounded-full bg-green-50 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                </div>
              )}
              <span className={`text-sm ${isBom ? "text-gray-700 dark:text-[#F0F0F0]" : "text-[#8A8A8A]"}`}>
                {texto}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default FinancialHealthPanel;
