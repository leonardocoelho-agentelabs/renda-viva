"use client";

import { useState, useEffect, useCallback } from "react";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { TransactionTable } from "./components/transaction-table";
import { UploadZone } from "./components/upload-zone";
import { createClient } from "@/lib/supabase/client";

interface Transaction {
  id: string;
  data: string;
  descricao_raw: string;
  categoria: string | null;
  valor: number;
  tipo: string;
  status_revisao: string;
}

export default function TransactionsPage() {
  const supabase = createClient();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [showUpload, setShowUpload] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

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
        .select("id, data, descricao_raw, categoria, valor, tipo, status_revisao")
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

  return (
    <DashboardLayout>
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Transações</h1>
            <p className="text-gray-500">Gerencie suas transações financeiras</p>
          </div>
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            {showUpload ? "Ocultar upload" : "Importar extrato"}
          </button>
        </div>
      </div>

      {showUpload && (
        <Card className="mb-8">
          <CardHeader>
            <h3 className="font-semibold">Importar extrato</h3>
          </CardHeader>
          <CardContent>
            <UploadZone onUploadComplete={handleUploadComplete} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Todas as transações</h3>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
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
            <div className="text-center py-12 text-gray-500">Carregando transações...</div>
          ) : (
            <TransactionTable transactions={transactions} />
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
