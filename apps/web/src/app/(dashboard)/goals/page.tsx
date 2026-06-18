"use client";

import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { createClient } from "@/lib/supabase/client";
import { Target, Plus, X, Sparkles, Lightbulb, MoreVertical, Trash2, CheckCircle } from "lucide-react";
import { MentorSection } from "./components/MentorSection";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Goal {
  id: string;
  nome: string;
  descricao: string | null;
  valor_alvo: number;
  valor_atual: number;
  data_alvo: string | null;
  instrumento_recomendado: string | null;
  prioridade: number;
  status: "ativa" | "pausada" | "concluida" | "cancelada";
  progresso?: number;
}

interface GoalPlan {
  aporte_mensal_necessario?: number;
  meses_necessarios?: number;
  instrumento_recomendado?: string;
  justificativa_instrumento?: string;
  viabilidade?: string;
  mensagem?: string;
  dica?: string;
}

function getMetaEmoji(nome: string): string {
  const n = nome.toLowerCase();
  if (n.includes("viagem") || n.includes("férias") || n.includes("europa") || n.includes("disney")) return "✈️";
  if (n.includes("carro") || n.includes("veículo") || n.includes("moto")) return "🚗";
  if (n.includes("casa") || n.includes("apto") || n.includes("imóvel")) return "🏠";
  if (n.includes("reserva") || n.includes("emergência") || n.includes("fundo")) return "🛡️";
  if (n.includes("casamento") || n.includes("festa")) return "💍";
  if (n.includes("faculdade") || n.includes("curso") || n.includes("estudo")) return "📚";
  if (n.includes("negócio") || n.includes("empresa") || n.includes("investimento")) return "💼";
  return "🎯";
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

function formatDate(date: string | null): string {
  if (!date) return "Sem prazo";
  return new Date(date + "T00:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function GoalsPage() {
  const supabase = createClient();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ nome: "", valor_alvo: "", data_alvo: "", descricao: "" });
  const [plan, setPlan] = useState<GoalPlan | null>(null);

  const [depositId, setDepositId] = useState<string | null>(null);
  const [depositValue, setDepositValue] = useState("");

  const [menuId, setMenuId] = useState<string | null>(null);
  const [deleteGoalId, setDeleteGoalId] = useState<string | null>(null);
  const [deleteGoalName, setDeleteGoalName] = useState<string>("");
  const [deleting, setDeleting] = useState(false);

  const getToken = useCallback(async (): Promise<string | null> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, [supabase]);

  const loadGoals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        setError("Sessão expirada. Faça login novamente.");
        return;
      }
      const res = await fetch(`${apiUrl}/goals`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const data = await res.json();
      setGoals(data.goals || []);
    } catch {
      setError("Não foi possível carregar as metas.");
    } finally {
      setLoading(false);
    }
  }, [apiUrl, getToken]);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  const openCreate = () => {
    setForm({ nome: "", valor_alvo: "", data_alvo: "", descricao: "" });
    setPlan(null);
    setShowCreate(true);
  };

  const handleCreate = async () => {
    const valorAlvo = parseFloat(form.valor_alvo.replace(",", "."));
    if (!form.nome.trim() || Number.isNaN(valorAlvo) || valorAlvo <= 0) return;

    setCreating(true);
    try {
      const token = await getToken();
      if (!token) {
        setError("Sessão expirada. Faça login novamente.");
        return;
      }
      const res = await fetch(`${apiUrl}/goals`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nome: form.nome.trim(),
          valor_alvo: valorAlvo,
          data_alvo: form.data_alvo || null,
          descricao: form.descricao || undefined,
        }),
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const data = await res.json();
      setPlan(data.plano || {});
      await loadGoals();
    } catch {
      setError("Não foi possível criar a meta. Tente novamente.");
      setShowCreate(false);
    } finally {
      setCreating(false);
    }
  };

  const handleDeposit = async (id: string) => {
    const valor = parseFloat(depositValue.replace(",", "."));
    if (Number.isNaN(valor) || valor <= 0) {
      setDepositId(null);
      return;
    }
    const token = await getToken();
    if (!token) return;
    const res = await fetch(`${apiUrl}/goals/${id}/deposit`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ valor }),
    });
    if (res.ok) {
      const data = await res.json();
      setGoals((prev) =>
        prev.map((g) =>
          g.id === id
            ? {
                ...g,
                valor_atual: Number(data.meta.valor_atual),
                status: data.meta.status,
                progresso:
                  Number(g.valor_alvo) > 0
                    ? (Number(data.meta.valor_atual) / Number(g.valor_alvo)) * 100
                    : 0,
              }
            : g
        )
      );
    }
    setDepositId(null);
    setDepositValue("");
  };

  const handleStatus = async (id: string, status: "ativa" | "pausada" | "cancelada") => {
    setMenuId(null);
    const token = await getToken();
    if (!token) return;
    const res = await fetch(`${apiUrl}/goals/${id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, status } : g)));
    }
  };

  const handleDelete = async () => {
    if (!deleteGoalId) return;
    setDeleting(true);
    const token = await getToken();
    if (!token) {
      setDeleting(false);
      setDeleteGoalId(null);
      return;
    }
    try {
      const res = await fetch(`${apiUrl}/goals/${deleteGoalId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setGoals((prev) => prev.filter((g) => g.id !== deleteGoalId));
        setSuccessMessage("Meta excluída com sucesso!");
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        throw new Error("Erro ao excluir");
      }
    } catch {
      setError("Não foi possível excluir a meta. Tente novamente.");
      setTimeout(() => setError(null), 4000);
    } finally {
      setDeleting(false);
      setDeleteGoalId(null);
      setDeleteGoalName("");
    }
  };

  const openDeleteConfirm = (id: string, nome: string) => {
    setMenuId(null);
    setDeleteGoalId(id);
    setDeleteGoalName(nome);
  };

  return (
    <DashboardLayout>
      <MentorSection />

      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-[var(--font-poppins)] font-bold text-2xl text-rv-ink dark:text-[#F0F0F0]">Metas</h1>
          <p className="text-rv-muted dark:text-[#8A8A8A]">Defina e acompanhe seus objetivos financeiros</p>
        </div>
        {goals.length > 0 && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-rv-green dark:bg-rv-vivid text-white text-sm font-medium hover:bg-rv-forest dark:hover:bg-rv-vivid/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nova Meta
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-6 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          {successMessage}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="h-10 w-10 rounded-full border-2 border-green-500 border-t-transparent animate-spin mb-4" />
          <p className="text-gray-400">Carregando metas...</p>
        </div>
      ) : goals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <span className="text-6xl mb-4">🎯</span>
          <h2 className="text-xl font-semibold text-gray-700 dark:text-[#F0F0F0] mb-2">
            Defina seus objetivos financeiros
          </h2>
          <p className="text-gray-400 dark:text-[#8A8A8A] mb-8 max-w-sm">
            A IA vai criar um plano personalizado baseado no seu histórico.
          </p>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Criar primeira meta
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {goals.map((g) => {
            const alvo = Number(g.valor_alvo);
            const atual = Number(g.valor_atual);
            const progresso = alvo > 0 ? Math.min((atual / alvo) * 100, 100) : 0;
            const concluida = g.status === "concluida";
            return (
              <div
                key={g.id}
                className={`bg-white dark:bg-[#1E1E1E] rounded-xl border p-5 ${
                  g.status === "cancelada" || g.status === "pausada"
                    ? "border-white/5 dark:border-white/5 opacity-70"
                    : "border-white/8 dark:border-white/8"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{getMetaEmoji(g.nome)}</span>
                    <div>
                      <h3 className="font-semibold text-rv-ink dark:text-[#F0F0F0] leading-tight">{g.nome}</h3>
                      <p className="text-xs text-[#8A8A8A]">{formatDate(g.data_alvo)}</p>
                    </div>
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => setMenuId(menuId === g.id ? null : g.id)}
                      className="p-1 rounded hover:bg-white/5 dark:hover:bg-white/5 text-[#8A8A8A]"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {menuId === g.id && (
                      <div className="absolute right-0 mt-1 w-44 bg-white dark:bg-[#1E1E1E] border border-white/10 dark:border-white/10 rounded-lg shadow-lg z-10 py-1 text-sm">
                        {g.status !== "pausada" && g.status !== "concluida" && (
                          <button
                            onClick={() => handleStatus(g.id, "pausada")}
                            className="block w-full text-left px-3 py-1.5 hover:bg-white/5 text-gray-700 dark:text-[#F0F0F0]"
                          >
                            Pausar
                          </button>
                        )}
                        {g.status === "pausada" && (
                          <button
                            onClick={() => handleStatus(g.id, "ativa")}
                            className="block w-full text-left px-3 py-1.5 hover:bg-white/5 text-gray-700 dark:text-[#F0F0F0]"
                          >
                            Reativar
                          </button>
                        )}
                        <button
                          onClick={() => handleStatus(g.id, "cancelada")}
                          className="block w-full text-left px-3 py-1.5 hover:bg-white/5 text-red-600 dark:text-red-400"
                        >
                          Cancelar
                        </button>
                        <div className="border-t border-white/10 dark:border-white/10 my-1" />
                        <button
                          onClick={() => openDeleteConfirm(g.id, g.nome)}
                          className="block w-full text-left px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 hover:text-red-600"
                        >
                          <span className="flex items-center gap-2">
                            <Trash2 className="h-3.5 w-3.5" />
                            Excluir meta
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="h-2.5 w-full rounded-full bg-[#2A2A2A] overflow-hidden mb-2">
                  <div
                    className="h-full rounded-full bg-rv-green dark:bg-rv-vivid transition-all"
                    style={{ width: `${progresso}%` }}
                  />
                </div>

                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-[#8A8A8A]">
                    <span className="font-medium text-rv-ink dark:text-[#F0F0F0]">{formatCurrency(atual)}</span> de{" "}
                    {formatCurrency(alvo)}
                  </p>
                  <span className="text-sm font-semibold text-[#8A8A8A]">
                    {progresso.toFixed(0)}%
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  {g.instrumento_recomendado && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-rv-mint dark:bg-rv-vivid/20 text-rv-green dark:text-rv-vivid">
                      {g.instrumento_recomendado}
                    </span>
                  )}
                  {concluida ? (
                    <span className="text-xs font-semibold text-rv-green dark:text-rv-vivid">✓ Concluída</span>
                  ) : g.status === "ativa" ? (
                    depositId === g.id ? (
                      <span className="inline-flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          autoFocus
                          value={depositValue}
                          onChange={(e) => setDepositValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleDeposit(g.id);
                            if (e.key === "Escape") setDepositId(null);
                          }}
                          placeholder="Valor"
                          className="w-24 border border-white/10 dark:border-white/10 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-rv-green dark:bg-[#2A2A2A] dark:text-[#F0F0F0]"
                        />
                        <button
                          onClick={() => handleDeposit(g.id)}
                          className="text-rv-green dark:text-rv-vivid text-xs font-medium hover:underline"
                        >
                          Salvar
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          setDepositId(g.id);
                          setDepositValue("");
                        }}
                        className="flex items-center gap-1 text-xs font-medium text-rv-green dark:text-rv-vivid hover:underline"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Registrar Aporte
                      </button>
                    )
                  ) : (
                    <span className="text-xs text-[#8A8A8A] capitalize">{g.status}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal criar meta */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white dark:bg-[#1E1E1E] rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            {plan ? (
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="h-5 w-5 text-rv-green dark:text-rv-vivid" />
                  <h2 className="font-[var(--font-poppins)] font-semibold text-lg text-rv-ink dark:text-[#F0F0F0]">Plano da IA</h2>
                </div>

                {typeof plan.aporte_mensal_necessario === "number" && (
                  <div className="rounded-lg bg-rv-mint dark:bg-rv-vivid/20 border border-white/10 p-4 mb-3">
                    <p className="text-sm text-[#8A8A8A]">Aporte mensal necessário</p>
                    <p className="text-2xl font-bold text-rv-green dark:text-rv-vivid font-[var(--font-poppins)]">
                      {formatCurrency(plan.aporte_mensal_necessario)}
                      {typeof plan.meses_necessarios === "number" && (
                        <span className="text-sm font-normal text-[#8A8A8A]">
                          {" "}por {plan.meses_necessarios} meses
                        </span>
                      )}
                    </p>
                  </div>
                )}

                {plan.instrumento_recomendado && (
                  <div className="mb-3">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-rv-mint dark:bg-rv-vivid/20 text-rv-green dark:text-rv-vivid">
                      {plan.instrumento_recomendado}
                    </span>
                    {plan.justificativa_instrumento && (
                      <p className="text-sm text-[#8A8A8A] mt-1.5">
                        {plan.justificativa_instrumento}
                      </p>
                    )}
                  </div>
                )}

                {plan.mensagem && (
                  <p className="text-sm text-rv-ink dark:text-[#F0F0F0] mb-3">{plan.mensagem}</p>
                )

                }
                {plan.dica && (
                  <div className="flex gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 p-3 mb-4">
                    <Lightbulb className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-800 dark:text-amber-300">{plan.dica}</p>
                  </div>
                )

                }

                <button
                  onClick={() => setShowCreate(false)}
                  className="w-full py-2.5 rounded-lg bg-rv-green dark:bg-rv-vivid text-white text-sm font-medium hover:bg-rv-forest dark:hover:bg-rv-vivid/90 transition-colors"
                >
                  Entendido
                </button>
              </div>
            ) : (
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-[var(--font-poppins)] font-semibold text-lg text-rv-ink dark:text-[#F0F0F0]">Nova Meta</h2>
                  <button
                    onClick={() => setShowCreate(false)}
                    className="p-1 rounded hover:bg-white/5 dark:hover:bg-white/5 text-[#8A8A8A]"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-rv-ink dark:text-[#F0F0F0] mb-1">
                      Nome da meta
                    </label>
                    <input
                      type="text"
                      value={form.nome}
                      onChange={(e) => setForm({ ...form, nome: e.target.value })}
                      placeholder="Ex: Viagem para Europa"
                      className="w-full px-3 py-2 border border-white/10 dark:border-white/10 rounded-lg text-sm dark:bg-[#2A2A2A] dark:text-[#F0F0F0] focus:outline-none focus:ring-2 focus:ring-rv-green"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-rv-ink dark:text-[#F0F0F0] mb-1">
                      Valor alvo (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.valor_alvo}
                      onChange={(e) => setForm({ ...form, valor_alvo: e.target.value })}
                      placeholder="Ex: 15000"
                      className="w-full px-3 py-2 border border-white/10 dark:border-white/10 rounded-lg text-sm dark:bg-[#2A2A2A] dark:text-[#F0F0F0] focus:outline-none focus:ring-2 focus:ring-rv-green"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-rv-ink dark:text-[#F0F0F0] mb-1">
                      Data alvo (opcional)
                    </label>
                    <input
                      type="date"
                      value={form.data_alvo}
                      onChange={(e) => setForm({ ...form, data_alvo: e.target.value })}
                      className="w-full px-3 py-2 border border-white/10 dark:border-white/10 rounded-lg text-sm dark:bg-[#2A2A2A] dark:text-[#F0F0F0] focus:outline-none focus:ring-2 focus:ring-rv-green"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-rv-ink dark:text-[#F0F0F0] mb-1">
                      Descrição (opcional)
                    </label>
                    <textarea
                      value={form.descricao}
                      onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                      rows={2}
                      placeholder="Detalhes sobre a meta..."
                      className="w-full px-3 py-2 border border-white/10 dark:border-white/10 rounded-lg text-sm dark:bg-[#2A2A2A] dark:text-[#F0F0F0] focus:outline-none focus:ring-2 focus:ring-rv-green resize-none"
                    />
                  </div>
                </div>

                <button
                  onClick={handleCreate}
                  disabled={
                    creating ||
                    !form.nome.trim() ||
                    !form.valor_alvo ||
                    parseFloat(form.valor_alvo.replace(",", ".")) <= 0
                  }
                  className="w-full mt-6 py-2.5 rounded-lg bg-rv-green dark:bg-rv-vivid text-white text-sm font-medium hover:bg-rv-forest dark:hover:bg-rv-vivid/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {creating ? "Analisando com IA..." : "Criar Meta"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AlertDialog de confirmação para excluir meta */}
      <AlertDialog open={deleteGoalId !== null} onOpenChange={(open) => !open && setDeleteGoalId(null)}>
        <AlertDialogContent className="bg-white dark:bg-[#1E1E1E]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-rv-ink dark:text-[#F0F0F0]">Excluir meta</AlertDialogTitle>
            <AlertDialogDescription className="text-[#8A8A8A]">
              Tem certeza que deseja excluir a meta "{deleteGoalName}"? Esta ação não pode ser desfeita e todos os dados de progresso serão perdidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-200 dark:border-white/10">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Excluindo..." : "Sim, excluir meta"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
