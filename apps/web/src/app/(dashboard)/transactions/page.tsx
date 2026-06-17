"use client";

import { useState, useEffect, useCallback } from "react";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { TransactionRow, type Transacao } from "./components/transaction-row";
import { TransactionModal } from "./components/transaction-modal";
import { UploadZone } from "./components/upload-zone";
import { createClient } from "@/lib/supabase/client";

type Transaction = Transacao;

export default function TransactionsPage() {
  const supabase = createClient();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [showUpload, setShowUpload] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [transacaoEditando, setTransacaoEditando] = useState<Transaction | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

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
  }, [selectedMonth, fetchTransactions]);

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
            <h1 className="font-[var(--font-poppins)] font-bold text-2xl text-rv-ink dark:text-rv-dark-ink">Transações</h1>
            <p className="text-rv-muted dark:text-rv-dark-muted">Gerencie suas transações financeiras</p>
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
              onClick={() => setShowUpload(!showUpload)}
              className="px-4 py-2 border border-rv-forest/10 dark:border-rv-light/10 text-rv-muted dark:text-rv-dark-muted rounded-lg text-sm font-medium hover:bg-rv-mint/30 dark:hover:bg-rv-dark-card transition-colors"
            >
              {showUpload ? "Ocultar upload" : "Importar extrato"}
            </button>
          </div>
        </div>
      </div>

      {showUpload && (
        <Card className="bg-white dark:bg-rv-dark-card border-rv-forest/10 dark:border-rv-light/10">
          <CardHeader>
            <h3 className="font-semibold text-rv-ink dark:text-rv-dark-ink">Importar extrato</h3>
          </CardHeader>
          <CardContent>
            <UploadZone onUploadComplete={handleUploadComplete} />
          </CardContent>
        </Card>
      )}

      <Card className="bg-white dark:bg-rv-dark-card border-rv-forest/10 dark:border-rv-light/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-rv-ink dark:text-rv-dark-ink">Todas as transações</h3>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-2 border border-rv-forest/10 dark:border-rv-light/10 rounded-lg text-sm text-rv-ink dark:text-rv-dark-ink dark:bg-rv-dark-card bg-white"
            >
              {months.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-rv-muted dark:text-rv-dark-muted">Carregando transações...</div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-rv-muted dark:text-rv-dark-muted">Nenhuma transação encontrada</p>
              <p className="text-sm text-rv-muted/70 dark:text-rv-dark-muted mt-2">
                Adicione uma transação ou importe um extrato para começar
              </p>
            </div>
          ) : (
            <div className="divide-y divide-rv-forest/10 dark:divide-rv-light/10">
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
        </CardContent>
      </Card>

      <TransactionModal
        isOpen={modalAberto}
        onClose={() => setModalAberto(false)}
        onSuccess={handleSuccess}
        transacao={transacaoEditando}
      />
    </DashboardLayout>
  );
}
