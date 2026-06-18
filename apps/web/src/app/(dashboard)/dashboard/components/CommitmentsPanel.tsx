"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Lock, AlertTriangle, TrendingUp, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface RecurringCommitment {
  id: string;
  nome: string;
  tipo: "assinatura" | "parcela";
  valor: number;
  dia_vencimento: number;
  parcelas_restantes: number | null;
  proxima_cobranca?: string;
  dias_para_vencimento?: number;
}

interface RecurringSummary {
  total_comprometido_mes: number;
  total_assinaturas: number;
  total_parcelas: number;
  valor_assinaturas: number;
  valor_parcelas: number;
  proximos_7_dias: RecurringCommitment[];
  proximos_30_dias: RecurringCommitment[];
  percentual_renda: number | null;
}

export function CommitmentsPanel() {
  const supabase = createClient();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
  const [summary, setSummary] = useState<RecurringSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [renda, setRenda] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        // Buscar resumo de compromissos
        const res = await fetch(`${apiUrl}/recurring/summary`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setSummary(data);
        }

        // Buscar renda do usuário
        const { data: userData } = await supabase
          .from("users")
          .select("renda_mensal")
          .eq("id", session.user.id)
          .single();

        if (userData?.renda_mensal) {
          setRenda(userData.renda_mensal);
        }
      } catch (err) {
        console.error("Erro ao buscar dados de compromissos:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [supabase, apiUrl]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getBarColor = (percentual: number) => {
    if (percentual <= 50) return "bg-rv-green";
    if (percentual <= 70) return "bg-amber-500";
    return "bg-red-500";
  };

  const getBarColorClass = (percentual: number) => {
    if (percentual <= 50) return "bg-rv-green dark:bg-rv-green";
    if (percentual <= 70) return "bg-amber-500";
    return "bg-red-500";
  };

  if (loading) {
    return (
      <Card className="bg-white dark:bg-[#1E1E1E] border border-gray-100 dark:border-white/8">
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-1/3 mb-4"></div>
            <div className="h-8 bg-gray-200 dark:bg-white/10 rounded w-1/2 mb-4"></div>
            <div className="h-2 bg-gray-200 dark:bg-white/10 rounded w-full"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!summary || (summary.total_assinaturas === 0 && summary.total_parcelas === 0)) {
    return null;
  }

  const percentual = summary.percentual_renda || 0;

  return (
    <Card className="bg-white dark:bg-[#1E1E1E] border border-gray-100 dark:border-white/8">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-rv-forest dark:text-rv-vivid" />
            <h3 className="font-semibold text-rv-ink dark:text-[#F0F0F0]">
              Orçamento Comprometido
            </h3>
          </div>
          <a
            href="/transactions"
            className="text-sm text-rv-green hover:text-rv-forest dark:text-rv-vivid"
          >
            Ver todos →
          </a>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Valor total comprometido */}
        <div>
          <p className="text-2xl font-bold text-rv-ink dark:text-[#F0F0F0]">
            {formatCurrency(summary.total_comprometido_mes)}
          </p>
          <p className="text-sm text-[#8A8A8A]">
            já comprometidos este mês
          </p>
        </div>

        {/* Percentual da renda */}
        {renda && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#8A8A8A]">
                {percentual.toFixed(1)}% da sua renda mensal ({formatCurrency(renda)})
              </span>
            </div>
            <div className="w-full bg-gray-100 dark:bg-white/10 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${getBarColorClass(percentual)}`}
                style={{ width: `${Math.min(percentual, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-[#8A8A8A]">
              <span>0%</span>
              <span className="text-amber-500">50%</span>
              <span className="text-red-500">70%</span>
              <span>100%</span>
            </div>
          </div>
        )}

        {/* Breakdown por tipo */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100 dark:border-white/5">
          <div className="flex items-center gap-2">
            <span className="text-lg">📺</span>
            <div>
              <p className="text-sm font-medium text-rv-ink dark:text-[#F0F0F0]">
                {summary.total_assinaturas} assinaturas
              </p>
              <p className="text-sm text-[#8A8A8A]">
                {formatCurrency(summary.valor_assinaturas)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg">💳</span>
            <div>
              <p className="text-sm font-medium text-rv-ink dark:text-[#F0F0F0]">
                {summary.total_parcelas} parcelas
              </p>
              <p className="text-sm text-[#8A8A8A]">
                {formatCurrency(summary.valor_parcelas)}
              </p>
            </div>
          </div>
        </div>

        {/* Próximos vencimentos */}
        {summary.proximos_7_dias.length > 0 && (
          <div className="pt-2 border-t border-gray-100 dark:border-white/5">
            <p className="text-sm font-medium text-rv-ink dark:text-[#F0F0F0] mb-2 flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              Próximos vencimentos
            </p>
            <div className="space-y-2">
              {summary.proximos_7_dias.slice(0, 3).map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between text-sm py-1"
                >
                  <div className="flex items-center gap-2">
                    {c.dias_para_vencimento !== undefined && c.dias_para_vencimento <= 3 && (
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                    )}
                    <span className="text-[#8A8A8A]">
                      {c.tipo === "assinatura" ? "📺" : "💳"}
                    </span>
                    <span className="text-rv-ink dark:text-[#F0F0F0]">{c.nome}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[#8A8A8A]">
                      dia {c.dia_vencimento}
                    </span>
                    <span className="font-medium text-rv-ink dark:text-[#F0F0F0]">
                      {formatCurrency(c.valor)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
