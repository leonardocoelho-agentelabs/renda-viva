"use client";

import { PieChart, Pie, Cell, Tooltip } from "recharts";
import { getCategoryColor } from "@/lib/category-colors";

interface CategoryData {
  name: string;
  value: number;
}

interface CategoryDonutChartProps {
  data: CategoryData[];
}

const CATEGORY_COLORS: Record<string, string> = {
  'Investimentos': '#6366F1',
  'Outros':        '#6B7280',
  'Educação':      '#EC4899',
  'Alimentação':   '#F97316',
  'Lazer':         '#A855F7',
  'Transporte':    '#3B82F6',
  'Moradia':       '#10B981',
  'Saúde':         '#EF4444',
  'Assinaturas':   '#14B8A6',
  'Receita':      '#22C55E',
};

export function CategoryDonutChart({ data }: CategoryDonutChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-rv-forest/10 dark:border-white/8 overflow-hidden">
        <div className="p-5 pb-0">
          <h3 className="font-poppins font-semibold text-rv-ink dark:text-[#F0F0F0] text-base">
            Gastos por categoria
          </h3>
          <p className="text-rv-muted dark:text-[#8A8A8A] text-xs mt-0.5">
            Este mês
          </p>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center p-5">
          <p className="text-sm text-[#8A8A8A]">Nenhum gasto registrado este mês</p>
        </div>
      </div>
    );
  }

  const totalGastos = data.reduce((sum, d) => sum + d.value, 0);
  const totalFormatado = totalGastos.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

  const chartData = data.map(cat => ({
    name: cat.name,
    value: Math.abs(cat.value),
    color: CATEGORY_COLORS[cat.name] || getCategoryColor(cat.name).hex,
    percentual: Math.round((Math.abs(cat.value) / totalGastos) * 100)
  })).sort((a, b) => b.value - a.value);

  const maiorCategoria = chartData[0];
  const menorCategoria = chartData[chartData.length - 1];

  return (
    <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl
                    border border-rv-forest/10 dark:border-white/8
                    overflow-hidden">

      {/* Header */}
      <div className="p-5 pb-0">
        <h3 className="font-poppins font-semibold text-rv-ink
                       dark:text-[#F0F0F0] text-base">
          Gastos por categoria
        </h3>
        <p className="text-rv-muted dark:text-[#8A8A8A] text-xs mt-0.5">
          Este mês
        </p>
      </div>

      <div className="grid grid-cols-2 gap-0">

        {/* COLUNA ESQUERDA — Painel escuro com donut */}
        <div className="bg-[#1a1a2e] dark:bg-[#0D0D1A] m-4 rounded-2xl
                        p-5 flex flex-col items-center justify-center
                        min-h-[220px] relative overflow-hidden">

          {/* Gradiente decorativo no fundo */}
          <div className="absolute inset-0 bg-gradient-to-br
                          from-purple-900/20 via-blue-900/10 to-transparent
                          rounded-2xl pointer-events-none" />

          {/* Título do painel */}
          <p className="text-white/60 text-xs font-medium mb-1 relative z-10">
            Total Gastos
          </p>

          {/* Valor total grande */}
          <p className="text-white font-poppins font-bold text-3xl
                        relative z-10 mb-4">
            R$ {totalFormatado}
          </p>

          {/* Gráfico donut usando Recharts */}
          <div className="relative z-10 w-full flex justify-center">
            <PieChart width={160} height={160}>
              <Pie
                data={chartData}
                cx={80}
                cy={80}
                innerRadius={52}
                outerRadius={75}
                paddingAngle={2}
                dataKey="value"
                strokeWidth={0}
              >
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) =>
                  [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, '']}
                contentStyle={{
                  background: '#1E1E1E',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: '#F0F0F0'
                }}
              />
            </PieChart>
          </div>

          {/* Maior e menor gasto */}
          <div className="flex gap-4 mt-3 relative z-10 w-full">
            <div className="flex-1 text-center">
              <p className="text-white/40 text-[10px]">Maior Gasto</p>
              {maiorCategoria && (
                <>
                  <p className="text-white/90 text-xs font-semibold mt-0.5">
                    {maiorCategoria.percentual}%
                  </p>
                  <p className="text-white/60 text-[10px]">
                    {maiorCategoria.name}
                  </p>
                </>
              )}
            </div>
            <div className="w-px bg-white/10" />
            <div className="flex-1 text-center">
              <p className="text-white/40 text-[10px]">Menor Gasto</p>
              {menorCategoria && (
                <>
                  <p className="text-white/90 text-xs font-semibold mt-0.5">
                    {menorCategoria.percentual}%
                  </p>
                  <p className="text-white/60 text-[10px]">
                    {menorCategoria.name}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA — Lista de categorias */}
        <div className="p-4 flex flex-col justify-center gap-1">
          {chartData.map((cat, index) => (
            <div key={index}
                 className="flex items-center gap-3 py-2 px-3
                            rounded-xl hover:bg-rv-mint/10
                            dark:hover:bg-white/5 transition-colors">

              {/* Ícone colorido */}
              <div className="w-8 h-8 rounded-xl flex items-center
                              justify-center flex-shrink-0"
                   style={{ backgroundColor: cat.color + '20' }}>
                <div className="w-3 h-3 rounded-full"
                     style={{ backgroundColor: cat.color }} />
              </div>

              {/* Nome */}
              <span className="flex-1 text-rv-ink dark:text-[#F0F0F0]
                               text-sm font-medium truncate">
                {cat.name}
              </span>

              {/* Percentual */}
              <span className="text-rv-muted dark:text-[#8A8A8A] text-xs">
                {cat.percentual}%
              </span>

              {/* Valor */}
              <span className="text-rv-ink dark:text-[#F0F0F0] text-sm
                               font-semibold min-w-[90px] text-right">
                R$ {cat.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>

              {/* Seta de tendência */}
              <svg viewBox="0 0 24 24" className="w-3 h-3 text-red-400 flex-shrink-0"
                   fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
              </svg>
            </div>
          ))}

          {/* Botão ver detalhes */}
          <button className="mt-3 w-full py-2.5 rounded-xl
                             border border-rv-forest/10 dark:border-white/8
                             text-rv-muted dark:text-[#8A8A8A] text-sm
                             hover:bg-rv-mint/20 dark:hover:bg-white/5
                             transition-colors">
            Ver Detalhes do Mês Anterior
          </button>
        </div>
      </div>
    </div>
  );
}

export default CategoryDonutChart;
