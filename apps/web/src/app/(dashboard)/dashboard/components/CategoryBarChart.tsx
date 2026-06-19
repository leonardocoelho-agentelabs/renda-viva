"use client";

import { getCategoryColor } from "@/lib/category-colors";

interface CategoryData {
  name: string;
  value: number;
}

interface CategoryBarChartProps {
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
  'Receita':       '#22C55E',
};

export function CategoryBarChart({ data }: CategoryBarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl
                      border border-rv-forest/10 dark:border-white/8 p-6">
        <h3 className="font-poppins font-semibold text-rv-ink dark:text-[#F0F0F0] text-base">
          Gastos por categoria
        </h3>
        <p className="text-rv-muted dark:text-[#8A8A8A] text-xs mt-0.5 mb-6">
          Este mês
        </p>
        <div className="flex flex-col items-center justify-center py-12 text-center">
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
                    border border-rv-forest/10 dark:border-white/8 p-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-poppins font-semibold text-rv-ink
                         dark:text-[#F0F0F0] text-base">
            Gastos por categoria
          </h3>
          <p className="text-rv-muted dark:text-[#8A8A8A] text-xs mt-0.5">
            Este mês
          </p>
        </div>
        <span className="font-poppins font-bold text-lg text-rv-ink
                         dark:text-[#F0F0F0]">
          Total: R$ {totalFormatado}
        </span>
      </div>

      {/* BARRAS HORIZONTAIS */}
      <div className="space-y-4">
        {chartData.map((cat) => (
          <div key={cat.name}>
            {/* Linha: nome + valor + percentual */}
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                     style={{ backgroundColor: cat.color }} />
                <span className="text-sm font-medium text-rv-ink
                                 dark:text-[#F0F0F0]">
                  {cat.name}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-rv-ink
                                 dark:text-[#F0F0F0]">
                  R$ {cat.value.toLocaleString('pt-BR',
                        { minimumFractionDigits: 2 })}
                </span>
                <span className="text-xs text-rv-muted dark:text-[#8A8A8A]
                                 min-w-[36px] text-right">
                  {cat.percentual}%
                </span>
              </div>
            </div>

            {/* Barra horizontal */}
            <div className="w-full bg-rv-forest/8 dark:bg-white/8
                            rounded-full h-2.5 overflow-hidden">
              <div
                className="h-2.5 rounded-full transition-all duration-700
                           ease-out"
                style={{
                  width: `${cat.percentual}%`,
                  backgroundColor: cat.color
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Linha separadora */}
      <div className="border-t border-rv-forest/8 dark:border-white/8 my-5" />

      {/* MAIOR E MENOR GASTO */}
      <div className="grid grid-cols-2 gap-4">

        {/* Maior gasto */}
        <div className="bg-rv-page dark:bg-[#2A2A2A] rounded-xl p-4">
          <p className="text-xs text-rv-muted dark:text-[#8A8A8A] mb-2">
            💸 Maior gasto
          </p>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2.5 h-2.5 rounded-full"
                 style={{ backgroundColor: maiorCategoria?.color }} />
            <span className="text-sm font-semibold text-rv-ink
                             dark:text-[#F0F0F0]">
              {maiorCategoria?.name}
            </span>
          </div>
          <p className="font-poppins font-bold text-xl text-rv-ink
                        dark:text-[#F0F0F0]">
            R$ {maiorCategoria?.value.toLocaleString('pt-BR',
                  { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-rv-muted dark:text-[#8A8A8A] mt-0.5">
            {maiorCategoria?.percentual}% do total
          </p>
        </div>

        {/* Menor gasto */}
        <div className="bg-rv-page dark:bg-[#2A2A2A] rounded-xl p-4">
          <p className="text-xs text-rv-muted dark:text-[#8A8A8A] mb-2">
            ✅ Menor gasto
          </p>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2.5 h-2.5 rounded-full"
                 style={{ backgroundColor: menorCategoria?.color }} />
            <span className="text-sm font-semibold text-rv-ink
                             dark:text-[#F0F0F0]">
              {menorCategoria?.name}
            </span>
          </div>
          <p className="font-poppins font-bold text-xl text-rv-ink
                        dark:text-[#F0F0F0]">
            R$ {menorCategoria?.value.toLocaleString('pt-BR',
                  { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-rv-muted dark:text-[#8A8A8A] mt-0.5">
            {menorCategoria?.percentual}% do total
          </p>
        </div>
      </div>
    </div>
  );
}

export default CategoryBarChart;
