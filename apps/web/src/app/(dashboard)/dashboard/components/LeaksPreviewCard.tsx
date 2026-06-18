"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Droplets, ArrowRight, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Vazamento {
  nome: string;
  total_periodo: number;
  economia_anual_potencial: number;
}

interface LeaksData {
  vazamentos: Vazamento[];
  total_vazamentos: number;
  economia_anual_total: number;
  periodo: number;
}

export function LeaksPreviewCard() {
  const [data, setData] = useState<LeaksData | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchLeaks() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          setLoading(false);
          return;
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
        const response = await fetch(`${apiUrl}/leaks/analyze?periodo=90`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          // Cache de 6 horas
          next: { revalidate: 21600 },
        });

        if (response.ok) {
          const result = await response.json();
          setData(result.data);
        }
      } catch (error) {
        console.error("Erro ao buscar vazamentos:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchLeaks();
  }, [supabase]);

  function formatCurrency(value: number): string {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-rv-dark-card rounded-2xl border border-gray-200 dark:border-white/10 p-5">
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 text-rv-green animate-spin" />
        </div>
      </div>
    );
  }

  if (!data || data.vazamentos.length === 0) {
    return null;
  }

  // Pegar top 3 vazamentos
  const topLeaks = data.vazamentos.slice(0, 3);

  return (
    <div className="bg-white dark:bg-rv-dark-card rounded-2xl border border-red-200 dark:border-red-900/50 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Droplets className="w-5 h-5 text-red-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Vazamentos detectados
          </h3>
        </div>
        <Link
          href="/vazamentos"
          className="text-sm text-rv-green hover:text-rv-green/80 flex items-center gap-1 transition-colors"
        >
          Ver análise completa
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Total */}
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        <span className="font-semibold text-gray-900 dark:text-white">
          {formatCurrency(data.total_vazamentos)}
        </span>{" "}
        em gastos invisíveis nos últimos {data.periodo} dias
      </p>

      {/* Lista de vazamentos */}
      <div className="space-y-2 mb-4">
        {topLeaks.map((leak, index) => (
          <div
            key={index}
            className="flex items-center justify-between text-sm py-1.5 border-b border-gray-100 dark:border-white/5 last:border-0"
          >
            <span className="text-gray-700 dark:text-gray-300 truncate flex-1 mr-2">
              • {leak.nome}
            </span>
            <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {formatCurrency(leak.total_periodo)}/{data.periodo >= 60 ? "90d" : "30d"}
            </span>
          </div>
        ))}
      </div>

      {/* Economia potencial */}
      <div className="bg-rv-mint/20 dark:bg-rv-green/10 rounded-xl p-3">
        <p className="text-sm text-rv-green dark:text-rv-mint font-medium">
          💰 Economia anual potencial:{" "}
          <span className="font-bold">{formatCurrency(data.economia_anual_total)}</span>
        </p>
      </div>
    </div>
  );
}
