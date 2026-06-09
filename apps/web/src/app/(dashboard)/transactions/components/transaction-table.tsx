"use client";

import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CategoryBadge, Badge } from "@/components/ui/badge";

interface Transaction {
  id: string;
  data: string;
  descricao_raw: string;
  categoria: string | null;
  valor: number;
  tipo: string;
  status_revisao: string;
}

interface TransactionTableProps {
  transactions: Transaction[];
}

export function TransactionTable({ transactions }: TransactionTableProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(Math.abs(value));
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy");
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "success" | "warning" | "default"> = {
      aprovado: "success",
      revisar: "warning",
      pendente: "default",
    };
    const labels: Record<string, string> = {
      aprovado: "Aprovado",
      revisar: "Revisar",
      pendente: "Pendente",
    };
    return <Badge variant={variants[status] || "default"}>{labels[status] || status}</Badge>;
  };

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Nenhuma transação encontrada</p>
        <p className="text-sm text-gray-400 mt-2">
          Faça upload de um extrato para começar
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Data</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Descrição</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Categoria</th>
            <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Valor</th>
            <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Status</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <tr key={tx.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-3 px-4 text-sm text-gray-900">{formatDate(tx.data)}</td>
              <td className="py-3 px-4 text-sm text-gray-900 max-w-[300px] truncate">
                {tx.descricao_raw}
              </td>
              <td className="py-3 px-4">
                <CategoryBadge category={tx.categoria || "Outros"} />
              </td>
              <td className={`py-3 px-4 text-sm text-right font-medium ${tx.valor >= 0 ? "text-green-600" : "text-red-600"}`}>
                {tx.valor >= 0 ? "+" : "-"}
                {formatCurrency(tx.valor)}
              </td>
              <td className="py-3 px-4 text-center">
                {getStatusBadge(tx.status_revisao)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}