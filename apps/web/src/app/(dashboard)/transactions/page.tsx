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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-[#F8FAFC]">Transações</h1>
            <p className="text-gray-500 dark:text-[#94A3B8]">Gerencie suas transações financeiras</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={abrirNova}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nova Transação
            </button>
            <button
              onClick={() => setShowUpload(!showUpload)}
              className="px-4 py-2 border border-gray-200 dark:border-[#1E293B] text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-[#1E293B] transition-colors"
            >
              {showUpload ? "Ocultar upload" : "Importar extrato"}
            </button>
          </div>
        </div>
      </div>

      {showUpload && (
        <Card className="mb-8">
          <CardHeader>
            <h3 className="font-semibold text-gray-900 dark:text-[#F8FAFC]">Importar extrato</h3>
          </CardHeader>
          <CardContent>
            <UploadZone onUploadComplete={handleUploadComplete} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-[#F8FAFC]">Todas as transações</h3>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-[#1E293B] rounded-lg text-sm text-gray-900 dark:text-[#F8FAFC] dark:bg-[#1E293B]"
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
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">Carregando transações...</div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">Nenhuma transação encontrada</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                Adicione uma transação ou importe um extrato para começar
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-[#1E293B]">
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
