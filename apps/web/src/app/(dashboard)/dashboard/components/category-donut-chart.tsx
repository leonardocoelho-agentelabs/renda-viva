"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { getCategoryColor } from "@/lib/category-colors";

interface CategoryData {
  name: string;
  value: number;
}

interface CategoryDonutChartProps {
  data: CategoryData[];
}

export function CategoryDonutChart({ data }: CategoryDonutChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white dark:bg-[#1E1E1E] rounded-xl border border-white/8 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-[#F0F0F0] mb-1">Gastos por categoria</h3>
        <p className="text-xs text-[#8A8A8A] mb-8">Este mês</p>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-[#8A8A8A]">Nenhum gasto registrado este mês</p>
        </div>
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + d.value, 0);
  const sorted = [...data].sort((a, b) => b.value - a.value);

  const chartData = sorted.map((d) => ({
    ...d,
    color: getCategoryColor(d.name).hex,
    percentual: total > 0 ? (d.value / total) * 100 : 0,
  }));

  return (
    <div className="bg-white dark:bg-[#1E1E1E] rounded-xl border border-white/8 shadow-sm p-6">
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-[#F0F0F0]">Gastos por categoria</h3>
        <p className="text-xs text-[#8A8A8A] mt-0.5">Este mês</p>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Gráfico de rosca */}
        <div className="relative w-full sm:w-44 h-44 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={2}
                stroke="none"
              >
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, name: string) => [`R$ ${Number(value).toFixed(2)}`, name]}
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid #E5E7EB",
                  fontSize: "12px",
                  padding: "8px 12px",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Total no centro */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xs text-[#8A8A8A]">Total</span>
            <span className="text-lg font-bold text-gray-900 dark:text-[#F0F0F0]">R$ {total.toFixed(0)}</span>
          </div>
        </div>

        {/* Legenda */}
        <div className="flex-1 w-full space-y-2.5">
          {chartData.slice(0, 6).map((item, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm text-gray-700 dark:text-[#F0F0F0] truncate">{item.name}</span>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-xs text-[#8A8A8A]">{item.percentual.toFixed(0)}%</span>
                <span className="text-sm font-medium text-gray-900 dark:text-[#F0F0F0] tabular-nums">
                  R$ {item.value.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default CategoryDonutChart;
