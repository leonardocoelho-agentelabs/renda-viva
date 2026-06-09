"use client";

import { useState } from "react";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { TransactionTable } from "./components/transaction-table";
import { UploadZone } from "./components/upload-zone";

interface Transaction {
  id: string;
  data: string;
  descricao_raw: string;
  categoria: string | null;
  valor: number;
  tipo: string;
  status_revisao: string;
}

// Mock data - em produção virá do Supabase/API
const mockTransactions: Transaction[] = [
  {
    id: "1",
    data: "2026-06-05",
    descricao_raw: "Supermercado Pão de Açúcar",
    categoria: "Alimentação",
    valor: -156.50,
    tipo: "debito",
    status_revisao: "aprovado",
  },
  {
    id: "2",
    data: "2026-06-04",
    descricao_raw: "Uber",
    categoria: "Transporte",
    valor: -32.90,
    tipo: "debito",
    status_revisao: "aprovado",
  },
  {
    id: "3",
    data: "2026-06-03",
    descricao_raw: "Salário",
    categoria: "Receita",
    valor: 5500.00,
    tipo: "credito",
    status_revisao: "aprovado",
  },
  {
    id: "4",
    data: "2026-06-02",
    descricao_raw: "Farmácia Droga Raia",
    categoria: "Saúde",
    valor: -89.90,
    tipo: "debito",
    status_revisao: "revisar",
  },
  {
    id: "5",
    data: "2026-06-01",
    descricao_raw: "Netflix",
    categoria: "Lazer",
    valor: -55.90,
    tipo: "debito",
    status_revisao: "aprovado",
  },
];

export default function TransactionsPage() {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [showUpload, setShowUpload] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>(mockTransactions);

  const months = Array.from({ length: 6 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, "yyyy-MM"),
      label: format(date, "MMMM yyyy", { locale: ptBR }),
    };
  });

  const handleUploadComplete = () => {
    // Em produção, recarregaríamos os dados do Supabase
    console.log("Upload completo!");
  };

  const filteredTransactions = transactions.filter((t) =>
    t.data.startsWith(selectedMonth)
  );

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
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
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
          <TransactionTable transactions={filteredTransactions} />
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}