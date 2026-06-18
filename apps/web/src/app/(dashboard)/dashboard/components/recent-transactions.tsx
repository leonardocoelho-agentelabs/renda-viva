"use client";

import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { CategoryBadge } from "@/components/ui/badge";

interface Transaction {
  id: string;
  data: string;
  descricao_raw: string;
  categoria: string | null;
  valor: number;
  tipo: string;
}

interface RecentTransactionsProps {
  transactions: Transaction[];
}

export function RecentTransactions({ transactions }: RecentTransactionsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(Math.abs(value));
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "dd MMM", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold text-gray-900 dark:text-[#F0F0F0]">Últimas transações</h3>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <p className="text-[#8A8A8A] text-center py-8">Nenhuma transação ainda</p>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-white/5 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className="text-sm text-[#8A8A8A] w-12">{formatDate(tx.data)}</div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-[#F0F0F0] truncate max-w-[200px]">
                      {tx.descricao_raw}
                    </p>
                    <CategoryBadge category={tx.categoria || "Outros"} />
                  </div>
                </div>
                <div className={tx.valor >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                  {tx.valor >= 0 ? "+" : "-"}
                  {formatCurrency(tx.valor)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
