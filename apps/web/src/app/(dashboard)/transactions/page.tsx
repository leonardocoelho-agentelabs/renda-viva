"use client";

import { useState, useEffect, useCallback } from "react";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { TransactionRow, type Transacao } from "./components/transaction-row";
import { TransactionModal } from "./components/transaction-modal";
import { RecurringModal } from "./components/RecurringModal";
import { RecurringList, type RecurringCommitment } from "./components/RecurringList";
import { UploadZone } from "./components/upload-zone";
import { createClient } from "@/lib/supabase/client";

type Transaction = Transacao;
type ViewFilter = "todas" | "transacoes" | "assinaturas" | "parcelas";

export default function TransactionsPage() {
  const supabase = createClient();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [showUpload, setShowUpload] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [transacaoEditando, setTransacaoEditando] = useState<Transaction | null>(null);
  const [recurringModalAberto, setRecurringModalAberto] = useState(false);
  const [recurringCommitments, setRecurringCommitments] = useState<RecurringCommitment[]>([]);
  const [viewFilter, setViewFilter] = useState<ViewFilter>("todas");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

  const fetchRecurringCommitments = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch(`${apiUrl}/recurring`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setRecurringCommitments(data.commitments || []);
      }
    } catch (err) {
      console.error("Erro ao buscar compromissos recorrentes:", err);
    }
  }, [supabase, apiUrl]);

  const months = Array.from({ length: 6 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, "yyyy-MM"),
      label: format(date, "MMMM yyyy", { locale: ptBR }),
    };
  });

  const fetchTransactions = useCallback(async (month: string) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const inicioMes = `${month}-01`;
      const [year, mon] = month.split("-").map(Number);
      const fimMes = format(new Date(year, mon, 0), "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("transactions")
        .select("id, data, descricao_raw, categoria, valor, tipo, status_revisao, is_recorrente, registrado_por")
        .eq("user_id", user.id)
        .gte("data", inicioMes)
        .lte("data", fimMes)
        .order("data", { ascending: false });

      if (!error && data) {
        setTransactions(data);
      }
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchTransactions(selectedMonth);
    fetchRecurringCommitments();
  }, [selectedMonth, fetchTransactions, fetchRecurringCommitments]);

  const handleUploadComplete = () => {
    setShowUpload(false);
    fetchTransactions(selectedMonth);
  };

  const abrirNova = () => {
    setTransacaoEditando(null);
    setModalAberto(true);
  };

  const abrirEdicao = (tx: Transaction) => {
    setTransacaoEditando(tx);
    setModalAberto(true);
  };

  const handleSuccess = () => {
    fetchTransactions(selectedMonth);
    fetchRecurringCommitments();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Excluir esta transação?")) return;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    const res = await fetch(`${apiUrl}/transactions/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) {
      setTransactions((prev) => prev.filter((t) => t.id !== id));
    }
  };

  const handleDuplicate = async (id: string) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    await fetch(`${apiUrl}/transactions/${id}/duplicate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    fetchTransactions(selectedMonth);
  };

  const handleToggleRecorrente = async (id: string, atual: boolean) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    await fetch(`${apiUrl}/transactions/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ is_recorrente: !atual }),
    });
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, is_recorrente: !atual } : t))
    );
  };

  return (
    <DashboardLayout>
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-[var(--font-poppins)] font-bold text-2xl text-rv-ink dark:text-[#F0F0F0]">Transações</h1>
            <p className="text-rv-muted dark:text-[#8A8A8A]">Gerencie suas transações financeiras</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={abrirNova}
              className="flex items-center gap-2 bg-rv-green dark:bg-rv-vivid text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-rv-forest dark:hover:bg-rv-vivid/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nova Transação
            </button>
            <button
              onClick={() => setRecurringModalAberto(true)}
              className="flex items-center gap-2 bg-rv-mint dark:bg-rv-green/20 text-rv-forest dark:text-rv-vivid border border-rv-forest/10 dark:border-rv-vivid/20 rounded-lg px-4 py-2 text-sm font-semibold hover:bg-rv-mint/80 dark:hover:bg-rv-green/30 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Compromisso
            </button>
            <button
              onClick={() => setShowUpload(!showUpload)}
              className="px-4 py-2 border border-white/10 text-[#8A8A8A] rounded-lg text-sm font-medium hover:bg-white/5 dark:hover:bg-white/5 transition-colors"
            >
              {showUpload ? "Ocultar upload" : "Importar extrato"}
            </button>
          </div>
        </div>
      </div>

      {showUpload && (
        <Card className="bg-white dark:bg-[#1E1E1E] border border-gray-100 dark:border-white/8">
          <CardHeader>
            <h3 className="font-semibold text-rv-ink dark:text-[#F0F0F0]">Importar extrato</h3>
          </CardHeader>
          <CardContent>
            <UploadZone onUploadComplete={handleUploadComplete} />
          </CardContent>
        </Card>
      )}

      <Card className="bg-white dark:bg-[#1E1E1E] border border-gray-100 dark:border-white/8">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h3 className="font-semibold text-rv-ink dark:text-[#F0F0F0]">Todas as transações</h3>
            <div className="flex items-center gap-3">
              {/* Filtros de visão */}
              <div className="flex items-center gap-1 bg-gray-50 dark:bg-white/5 rounded-full p-1">
                {[
                  { key: "todas" as ViewFilter, label: "Todas" },
                  { key: "transacoes" as ViewFilter, label: "Transações" },
                  { key: "assinaturas" as ViewFilter, label: "Assinaturas" },
                  { key: "parcelas" as ViewFilter, label: "Parcelas" },
                ].map((filter) => (
                  <button
                    key={filter.key}
                    onClick={() => setViewFilter(filter.key)}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                      viewFilter === filter.key
                        ? "bg-rv-forest dark:bg-rv-vivid text-white"
                        : "text-rv-muted hover:text-rv-ink dark:text-[#8A8A8A] dark:hover:text-[#F0F0F0]"
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-sm text-rv-ink dark:text-[#F0F0F0] dark:bg-[#1E1E1E] bg-white"
              >
                {months.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-[#8A8A8A]">Carregando...</div>
          ) : viewFilter === "todas" ? (
            <>
              {/* Compromissos recorrentes primeiro */}
              {recurringCommitments.filter((c) => c.status === "ativo").length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-rv-ink dark:text-[#F0F0F0] mb-3 flex items-center gap-2">
                    <span>🔒</span> Compromissos Recorrentes
                  </h4>
                  <RecurringList
                    commitments={recurringCommitments.filter((c) => c.status === "ativo")}
                    onUpdate={fetchRecurringCommitments}
                  />
                </div>
              )}

              {/* Transações */}
              <div>
                <h4 className="text-sm font-semibold text-rv-ink dark:text-[#F0F0F0] mb-3 flex items-center gap-2">
                  <span>💰</span> Transações do período
                </h4>
                {transactions.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-[#8A8A8A]">Nenhuma transação encontrada</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-white/5">
                    {transactions.map((tx) => (
                      <TransactionRow
                        key={tx.id}
                        transacao={tx}
                        onEdit={abrirEdicao}
                        onDuplicate={handleDuplicate}
                        onToggleRecorrente={handleToggleRecorrente}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : viewFilter === "transacoes" ? (
            transactions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-[#8A8A8A]">Nenhuma transação encontrada</p>
                <p className="text-sm text-[#8A8A8A]/70 mt-2">
                  Adicione uma transação ou importe um extrato para começar
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-white/5">
                {transactions.map((tx) => (
                  <TransactionRow
                    key={tx.id}
                    transacao={tx}
                    onEdit={abrirEdicao}
                    onDuplicate={handleDuplicate}
                    onToggleRecorrente={handleToggleRecorrente}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )
          ) : viewFilter === "assinaturas" ? (
            <RecurringList
              commitments={recurringCommitments.filter((c) => c.tipo === "assinatura")}
              onUpdate={fetchRecurringCommitments}
            />
          ) : (
            <RecurringList
              commitments={recurringCommitments.filter((c) => c.tipo === "parcela")}
              onUpdate={fetchRecurringCommitments}
            />
          )}
        </CardContent>
      </Card>

      <TransactionModal
        isOpen={modalAberto}
        onClose={() => setModalAberto(false)}
        onSuccess={handleSuccess}
        transacao={transacaoEditando}
      />

      <RecurringModal
        isOpen={recurringModalAberto}
        onClose={() => setRecurringModalAberto(false)}
        onSuccess={() => {
          setRecurringModalAberto(false);
          fetchRecurringCommitments();
        }}
      />
    </DashboardLayout>
  );
}
