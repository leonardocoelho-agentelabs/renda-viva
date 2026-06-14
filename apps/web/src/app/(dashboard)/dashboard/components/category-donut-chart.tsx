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
      <div className="bg-white dark:bg-[#111827] rounded-xl border border-gray-100 dark:border-[#1E293B] shadow-sm p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-[#F8FAFC] mb-1">Gastos por categoria</h3>
        <p className="text-xs text-gray-500 dark:text-[#94A3B8] mb-8">Este mês</p>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">Nenhum gasto registrado este mês</p>
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
    <div className="bg-white dark:bg-[#111827] rounded-xl border border-gray-100 dark:border-[#1E293B] shadow-sm p-6">
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-[#F8FAFC]">Gastos por categoria</h3>
        <p className="text-xs text-gray-500 dark:text-[#94A3B8] mt-0.5">Este mês</p>
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
            <span className="text-xs text-gray-400 dark:text-gray-500">Total</span>
            <span className="text-lg font-bold text-gray-900 dark:text-[#F8FAFC]">R$ {total.toFixed(0)}</span>
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
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{item.name}</span>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-xs text-gray-400 dark:text-gray-500">{item.percentual.toFixed(0)}%</span>
                <span className="text-sm font-medium text-gray-900 dark:text-[#F8FAFC] tabular-nums">
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
