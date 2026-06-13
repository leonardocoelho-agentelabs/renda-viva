"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface ForecastChartProps {
  data: { data_prevista: string; saldo_projetado: number; confianca: number }[];
}

export function ForecastChart({ data }: ForecastChartProps) {
  if (!data || data.length === 0) return null;

  const chartData = data.map((d) => ({
    data: new Date(d.data_prevista + "T00:00:00").toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    }),
    saldo: Number(d.saldo_projetado),
    confianca: Math.round(Number(d.confianca) * 100),
  }));

  const minSaldo = Math.min(...chartData.map((d) => d.saldo));

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Previsão de Saldo — 30 dias</h3>
          <p className="text-xs text-gray-500 mt-0.5">Baseado no seu histórico financeiro</p>
        </div>
        <span
          className={`text-xs font-medium px-2 py-1 rounded-full ${
            minSaldo >= 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {minSaldo >= 0 ? "✅ Saldo positivo" : "⚠️ Risco de saldo negativo"}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
          <XAxis
            dataKey="data"
            tick={{ fontSize: 11, fill: "#9CA3AF" }}
            tickLine={false}
            interval={4}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#9CA3AF" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `R$ ${Number(v).toFixed(0)}`}
          />
          <Tooltip
            formatter={(value: number) => [`R$ ${Number(value).toFixed(2)}`, "Saldo projetado"]}
            labelStyle={{ fontSize: 12 }}
            contentStyle={{ borderRadius: "8px", border: "1px solid #E5E7EB", fontSize: 12 }}
          />
          <ReferenceLine y={0} stroke="#EF4444" strokeDasharray="4 4" />
          <Line
            type="monotone"
            dataKey="saldo"
            stroke="#16a34a"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "#16a34a" }}
          />
        </LineChart>
      </ResponsiveContainer>

      <p className="text-xs text-gray-400 mt-3 text-center">
        Projeção baseada em receitas e despesas recorrentes dos últimos 3 meses
      </p>
    </div>
  );
}
