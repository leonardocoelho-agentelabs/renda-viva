import { type LucideIcon, ArrowUp, ArrowDown } from "lucide-react";

interface SummaryCardProps {
  label: string;
  value: string;
  variacao?: number | null;
  variacaoLabel?: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  variacaoInvertida?: boolean; // true quando "subir" é ruim (ex: gastos)
}

export function SummaryCard({
  label,
  value,
  variacao,
  variacaoLabel,
  icon: Icon,
  iconBg,
  iconColor,
  variacaoInvertida,
}: SummaryCardProps) {
  const temVariacao = variacao !== null && variacao !== undefined;
  const isPositivo = temVariacao && variacao >= 0;
  const corBoa = variacaoInvertida ? !isPositivo : isPositivo;

  return (
    <div className="bg-white dark:bg-[#111827] rounded-2xl border border-gray-100 dark:border-[#1E293B] shadow-[0_2px_10px_rgba(0,0,0,0.03)] p-6 hover:shadow-[0_10px_30px_rgba(0,0,0,0.05)] transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-medium text-gray-500 dark:text-[#94A3B8] uppercase tracking-wide">{label}</span>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-[#F8FAFC] tabular-nums">{value}</p>
      {temVariacao ? (
        <div className="flex items-center gap-1 mt-2">
          {isPositivo ? (
            <ArrowUp className={`w-3.5 h-3.5 ${corBoa ? "text-green-600" : "text-red-500"}`} />
          ) : (
            <ArrowDown className={`w-3.5 h-3.5 ${corBoa ? "text-green-600" : "text-red-500"}`} />
          )}
          <span className={`text-xs font-medium ${corBoa ? "text-green-600" : "text-red-500"}`}>
            {Math.abs(variacao as number).toFixed(1)}%
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">{variacaoLabel || "vs mês anterior"}</span>
        </div>
      ) : variacao === null ? (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Sem dados do mês anterior</p>
      ) : null}
    </div>
  );
}

export default SummaryCard;
