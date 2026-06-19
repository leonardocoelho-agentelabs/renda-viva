"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
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

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl
                      border border-rv-forest/10 dark:border-white/8 p-5
                      flex flex-col h-full">
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 text-rv-green animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl
                    border border-rv-forest/10 dark:border-white/8 p-5
                    flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-poppins font-semibold text-rv-ink
                       dark:text-[#F0F0F0] text-base">
          💧 Vazamentos detectados
        </h3>
        <a href="/vazamentos"
           className="text-rv-green dark:text-rv-vivid text-xs
                      font-semibold hover:opacity-80 transition-opacity">
          Ver análise →
        </a>
      </div>

      {/* Estado: sem análise ainda */}
      {!data || data.vazamentos.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center
                        text-center py-6">
          <div className="w-12 h-12 rounded-2xl bg-rv-mint/50
                          dark:bg-rv-green/10 flex items-center
                          justify-center mb-3">
            <span className="text-2xl">💧</span>
          </div>
          <p className="text-rv-muted dark:text-[#8A8A8A] text-sm mb-3">
            Ainda não foi feita uma análise de vazamentos
          </p>
          <a href="/vazamentos"
             className="px-4 py-2 rounded-xl bg-rv-green
                        dark:bg-rv-vivid text-white text-sm
                        font-semibold hover:opacity-90 transition-opacity">
            Analisar agora
          </a>
        </div>
      ) : (
        <>
          {/* Estado: com análise */}
          <div className="bg-red-50 dark:bg-red-950/20 rounded-xl p-4 mb-4
                          border border-red-100 dark:border-red-900/30">
            <p className="text-red-600 dark:text-red-400 font-poppins
                          font-bold text-2xl">
              R$ {data.total_vazamentos.toLocaleString('pt-BR',
                    { minimumFractionDigits: 2 })}
            </p>
            <p className="text-red-500 dark:text-red-400/70 text-xs mt-0.5">
              em gastos invisíveis detectados
            </p>
          </div>

          <div className="space-y-2 flex-1 overflow-y-auto max-h-[200px]">
            {data.vazamentos.slice(0, 4).map((v, i) => (
              <div key={i}
                   className="flex items-center justify-between py-2
                              border-b border-rv-forest/5 dark:border-white/5
                              last:border-0">
                <span className="text-sm text-rv-ink dark:text-[#F0F0F0]
                                 truncate flex-1">
                  {v.nome}
                </span>
                <span className="text-sm font-semibold text-red-500
                                 ml-2 flex-shrink-0">
                  -R$ {v.total_periodo.toLocaleString('pt-BR',
                        { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-3 pt-3 border-t border-rv-forest/5
                          dark:border-white/5">
            <p className="text-xs text-rv-muted dark:text-[#8A8A8A]">
              💰 Economia anual potencial:{' '}
              <span className="font-semibold text-rv-green dark:text-rv-vivid">
                R$ {data.economia_anual_total.toLocaleString('pt-BR',
                      { minimumFractionDigits: 2 })}
              </span>
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export default LeaksPreviewCard;
