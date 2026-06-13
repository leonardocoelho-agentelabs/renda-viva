"use client";

import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { createClient } from "@/lib/supabase/client";
import { PieChart, Sparkles, Check, Pencil } from "lucide-react";

interface Budget {
  id: string;
  mes_ano: string;
  categoria: string;
  limite: number;
  gasto_atual: number;
  status: "sugerido" | "aprovado" | "encerrado";
}

type Tipo = "necessidade" | "desejo" | "investimento";

const TIPO_POR_CATEGORIA: Record<string, Tipo> = {
  Moradia: "necessidade",
  Alimentação: "necessidade",
  Saúde: "necessidade",
  Transporte: "necessidade",
  Lazer: "desejo",
  Educação: "desejo",
  Outros: "desejo",
  Investimentos: "investimento",
  Reserva: "investimento",
};

const TIPO_BADGE: Record<Tipo, string> = {
  necessidade: "bg-blue-100 text-blue-700",
  desejo: "bg-purple-100 text-purple-700",
  investimento: "bg-emerald-100 text-emerald-700",
};

function getTipo(categoria: string): Tipo {
  return TIPO_POR_CATEGORIA[categoria] ?? "desejo";
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

function corBarra(percentual: number): string {
  if (percentual >= 90) return "bg-red-500";
  if (percentual >= 70) return "bg-yellow-500";
  return "bg-green-500";
}

export default function BudgetPage() {
  const supabase = createClient();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

  const getToken = useCallback(async (): Promise<string | null> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, [supabase]);

  const loadBudgets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        setError("Sessão expirada. Faça login novamente.");
        return;
      }
      const res = await fetch(`${apiUrl}/budget/current`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const data = await res.json();
      setBudgets(data.budgets || []);
    } catch {
      setError("Não foi possível carregar o orçamento.");
    } finally {
      setLoading(false);
    }
  }, [apiUrl, getToken]);

  useEffect(() => {
    loadBudgets();
  }, [loadBudgets]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        setError("Sessão expirada. Faça login novamente.");
        return;
      }
      const res = await fetch(`${apiUrl}/budget/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      // Recarrega com gasto_atual recalculado
      await loadBudgets();
    } catch {
      setError("Não foi possível gerar o orçamento. Tente novamente.");
    } finally {
      setGenerating(false);
    }
  };

  const handleApprove = async (id: string) => {
    const token = await getToken();
    if (!token) return;
    const res = await fetch(`${apiUrl}/budget/${id}/approve`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setBudgets((prev) =>
        prev.map((b) => (b.id === id ? { ...b, status: "aprovado" } : b))
      );
    }
  };

  const startEdit = (b: Budget) => {
    setEditingId(b.id);
    setEditValue(String(b.limite));
  };

  const handleSaveLimit = async (id: string) => {
    const limite = parseFloat(editValue.replace(",", "."));
    if (Number.isNaN(limite) || limite < 0) {
      setEditingId(null);
      return;
    }
    const token = await getToken();
    if (!token) return;
    const res = await fetch(`${apiUrl}/budget/${id}/limit`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ limite }),
    });
    if (res.ok) {
      setBudgets((prev) =>
        prev.map((b) => (b.id === id ? { ...b, limite } : b))
      );
    }
    setEditingId(null);
  };

  const totalOrcado = budgets.reduce((s, b) => s + Number(b.limite), 0);
  const totalGasto = budgets.reduce((s, b) => s + Number(b.gasto_atual), 0);
  const percentualGeral = totalOrcado > 0 ? (totalGasto / totalOrcado) * 100 : 0;

  return (
    <DashboardLayout>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orçamentos</h1>
          <p className="text-gray-500">Gerencie seus limites de gastos por categoria</p>
        </div>
        {budgets.length > 0 && (
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Sparkles className="h-4 w-4" />
            {generating ? "Gerando..." : "Gerar Orçamento do Mês"}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="h-10 w-10 rounded-full border-2 border-green-500 border-t-transparent animate-spin mb-4" />
          <p className="text-gray-400">Carregando orçamento...</p>
        </div>
      ) : budgets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <PieChart className="h-16 w-16 text-gray-300 mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            Nenhum orçamento para este mês
          </h2>
          <p className="text-gray-400 mb-8 max-w-sm">
            Gere um orçamento inteligente baseado no seu histórico de gastos e na regra
            50/30/20 adaptada à sua realidade.
          </p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Sparkles className="h-4 w-4" />
            {generating ? "Gerando orçamento..." : "Gerar Orçamento do Mês"}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Resumo geral */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-sm text-gray-500">Total gasto</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(totalGasto)}
                  <span className="text-base font-normal text-gray-400">
                    {" "}
                    de {formatCurrency(totalOrcado)}
                  </span>
                </p>
              </div>
              <span className="text-lg font-semibold text-gray-700">
                {percentualGeral.toFixed(0)}%
              </span>
            </div>
            <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${corBarra(percentualGeral)}`}
                style={{ width: `${Math.min(percentualGeral, 100)}%` }}
              />
            </div>
          </div>

          {/* Cards por categoria */}
          <div className="grid gap-4 sm:grid-cols-2">
            {budgets.map((b) => {
              const limite = Number(b.limite);
              const gasto = Number(b.gasto_atual);
              const percentual = limite > 0 ? (gasto / limite) * 100 : 0;
              const tipo = getTipo(b.categoria);
              return (
                <div
                  key={b.id}
                  className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900">{b.categoria}</h3>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${TIPO_BADGE[tipo]}`}
                      >
                        {tipo}
                      </span>
                      {b.status === "sugerido" && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          sugerido
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-gray-600">
                      {percentual.toFixed(0)}%
                    </span>
                  </div>

                  <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden mb-2">
                    <div
                      className={`h-full rounded-full transition-all ${corBarra(percentual)}`}
                      style={{ width: `${Math.min(percentual, 100)}%` }}
                    />
                  </div>

                  <p className="text-sm text-gray-500 mb-4">
                    {formatCurrency(gasto)} gastos de{" "}
                    {editingId === b.id ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="text-gray-400">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveLimit(b.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          autoFocus
                          className="w-24 border border-gray-300 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                        />
                        <button
                          onClick={() => handleSaveLimit(b.id)}
                          className="text-green-600 text-xs font-medium hover:underline"
                        >
                          Salvar
                        </button>
                      </span>
                    ) : (
                      <span className="font-medium text-gray-700">
                        {formatCurrency(limite)}
                      </span>
                    )}
                  </p>

                  {b.status === "sugerido" && editingId !== b.id && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(b.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Aprovar
                      </button>
                      <button
                        onClick={() => startEdit(b)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 text-xs font-medium hover:bg-gray-50 transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Editar limite
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
