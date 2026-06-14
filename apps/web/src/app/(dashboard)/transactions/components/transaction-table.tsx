"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
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
  onEdit?: (tx: Transaction) => void;
  onDelete?: (id: string) => void;
}

export function TransactionTable({ transactions, onEdit, onDelete }: TransactionTableProps) {
  const [menuId, setMenuId] = useState<string | null>(null);

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
          Adicione uma transação ou faça upload de um extrato para começar
        </p>
      </div>
    );
  }

  const interativo = !!onEdit || !!onDelete;

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr className="border-b border-gray-100">
            <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Data</th>
            <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Descrição</th>
            <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Categoria</th>
            <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Valor</th>
            <th className="hidden md:table-cell text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
            {interativo && <th className="w-10" />}
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <tr
              key={tx.id}
              onClick={onEdit ? () => onEdit(tx) : undefined}
              className={`border-b border-gray-100 hover:bg-gray-50 ${onEdit ? "cursor-pointer" : ""}`}
            >
              <td className="py-3 px-4 text-sm text-gray-600">{formatDate(tx.data)}</td>
              <td className="py-3 px-4 text-sm text-gray-900 max-w-[300px] truncate">
                {tx.descricao_raw}
              </td>
              <td className="py-3 px-4">
                <CategoryBadge category={tx.categoria || "Outros"} />
              </td>
              <td className={`py-3 px-4 text-sm text-right font-medium ${tx.valor >= 0 ? "text-green-600" : "text-gray-900"}`}>
                {tx.valor >= 0 ? "+" : "-"}
                {formatCurrency(tx.valor)}
              </td>
              <td className="hidden md:table-cell py-3 px-4 text-center">
                {getStatusBadge(tx.status_revisao)}
              </td>
              {interativo && (
                <td className="py-3 px-2 text-right">
                  <div className="relative inline-block">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuId(menuId === tx.id ? null : tx.id);
                      }}
                      className="p-1 rounded hover:bg-gray-200 text-gray-400"
                      aria-label="Ações"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {menuId === tx.id && (
                      <div
                        className="absolute right-0 mt-1 w-36 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 text-sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {onEdit && (
                          <button
                            onClick={() => {
                              setMenuId(null);
                              onEdit(tx);
                            }}
                            className="flex items-center gap-2 w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </button>
                        )}
                        {onDelete && (
                          <button
                            onClick={() => {
                              setMenuId(null);
                              onDelete(tx.id);
                            }}
                            className="flex items-center gap-2 w-full text-left px-3 py-1.5 hover:bg-gray-50 text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Excluir
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
