"use client";

import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
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

  // Limitar a 10 transações visíveis
  const transacoesVisiveis = transactions.slice(0, 10);

  return (
    <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl
                    border border-rv-forest/10 dark:border-white/8">

      {/* Header fixo */}
      <div className="flex items-center justify-between p-5 pb-3">
        <div>
          <h3 className="font-poppins font-semibold text-rv-ink
                         dark:text-[#F0F0F0] text-base">
            Últimas transações
          </h3>
        </div>
        <a href="/transactions"
           className="text-rv-green dark:text-rv-vivid text-xs
                      font-semibold hover:opacity-80 transition-opacity">
          Ver todas →
        </a>
      </div>

      {/* Lista com scroll — altura fixa */}
      <div className="overflow-y-auto max-h-[400px] px-3 pb-3
                      scrollbar-thin scrollbar-thumb-rv-forest/10
                      dark:scrollbar-thumb-white/10
                      scrollbar-track-transparent">
        {transacoesVisiveis.length === 0 ? (
          <p className="text-[#8A8A8A] text-center py-8">Nenhuma transação ainda</p>
        ) : (
          transacoesVisiveis.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between py-3 px-2
                         border-b border-rv-forest/5 dark:border-white/5 last:border-0
                         hover:bg-rv-mint/5 dark:hover:bg-white/5
                         rounded-lg transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="text-sm text-[#8A8A8A] w-12">{formatDate(tx.data)}</div>
                <div>
                  <p className="text-sm font-medium text-rv-ink dark:text-[#F0F0F0] truncate max-w-[200px]">
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
          ))
        )}
      </div>

      {/* Footer com link */}
      <div className="border-t border-rv-forest/5 dark:border-white/5
                      p-3 text-center">
        <a href="/transactions"
           className="text-rv-muted dark:text-[#8A8A8A] text-xs
                      hover:text-rv-green dark:hover:text-rv-vivid
                      transition-colors">
          Ver todas as transações →
        </a>
      </div>
    </div>
  );
}

export default RecentTransactions;
