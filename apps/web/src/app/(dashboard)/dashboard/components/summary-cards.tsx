"use client";

import { TrendingUp, TrendingDown, Wallet, Target, Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SummaryCardsProps {
  saldo: number;
  totalGastos: number;
  totalReceitas: number;
  scoreSaude: number;
  totalTransacoes: number;
}

export function SummaryCards({ saldo, totalGastos, totalReceitas, scoreSaude, totalTransacoes }: SummaryCardsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-green-600";
    if (score >= 40) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreBg = (score: number) => {
    if (score >= 70) return "bg-green-50";
    if (score >= 40) return "bg-yellow-50";
    return "bg-red-50";
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {/* Saldo do Mês */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <Wallet className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Saldo do mês</p>
              <p className={cn("text-2xl font-bold", saldo >= 0 ? "text-green-600" : "text-red-600")}>
                {formatCurrency(saldo)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Total de Gastos */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-100 rounded-lg">
              <TrendingDown className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total de gastos</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(totalGastos)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Score de Saúde */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className={cn("p-3 rounded-lg", getScoreBg(scoreSaude))}>
              <Activity className={cn("h-6 w-6", getScoreColor(scoreSaude))} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Score de saúde</p>
              <p className={cn("text-2xl font-bold", getScoreColor(scoreSaude))}>
                {scoreSaude}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transações */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Transações</p>
              <p className="text-2xl font-bold text-gray-900">{totalTransacoes}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}