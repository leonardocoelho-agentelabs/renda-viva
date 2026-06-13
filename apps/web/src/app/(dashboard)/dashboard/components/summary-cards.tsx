"use client";

import { TrendingDown, Wallet, Activity, Hash } from "lucide-react";
import { cn } from "@/lib/utils";

interface SummaryCardsProps {
  saldo: number;
  totalGastos: number;
  totalReceitas: number;
  scoreSaude: number;
  totalTransacoes: number;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

const mesAtual = new Date().toLocaleDateString("pt-BR", {
  month: "long",
  year: "numeric",
});
const mesLabel = mesAtual.charAt(0).toUpperCase() + mesAtual.slice(1);

export function SummaryCards({
  saldo,
  totalGastos,
  scoreSaude,
  totalTransacoes,
}: SummaryCardsProps) {
  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-green-600";
    if (score >= 40) return "text-yellow-600";
    return "text-red-600";
  };

  const cards = [
    {
      label: "Saldo do Mês",
      value: formatCurrency(saldo),
      sub: mesLabel,
      icon: Wallet,
      iconBg: "bg-green-50",
      iconColor: "text-green-600",
      valueColor: saldo >= 0 ? "text-gray-900" : "text-red-600",
    },
    {
      label: "Total de Gastos",
      value: formatCurrency(totalGastos),
      sub: mesLabel,
      icon: TrendingDown,
      iconBg: "bg-red-50",
      iconColor: "text-red-500",
      valueColor: "text-gray-900",
    },
    {
      label: "Score de Saúde",
      value: String(scoreSaude),
      sub: "de 100",
      icon: Activity,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-500",
      valueColor: getScoreColor(scoreSaude),
    },
    {
      label: "Transações",
      value: String(totalTransacoes),
      sub: mesLabel,
      icon: Hash,
      iconBg: "bg-gray-50",
      iconColor: "text-gray-500",
      valueColor: "text-gray-900",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-white rounded-xl border border-gray-100 shadow-sm p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {card.label}
            </span>
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", card.iconBg)}>
              <card.icon className={cn("h-4 w-4", card.iconColor)} />
            </div>
          </div>
          <p className={cn("text-[28px] leading-none font-bold", card.valueColor)}>
            {card.value}
          </p>
          <p className="text-xs text-gray-400 mt-1.5">{card.sub}</p>
        </div>
      ))}
    </div>
  );
}
