import { type LucideIcon, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SummaryCardProps {
  label: string;
  value: string;
  variacao?: number | null;
  variacaoLabel?: string;
  icon: LucideIcon;
  variacaoInvertida?: boolean; // true quando "subir" é ruim (ex: gastos)
}

export function SummaryCard({
  label,
  value,
  variacao,
  variacaoLabel,
  icon: Icon,
  variacaoInvertida,
}: SummaryCardProps) {
  const temVariacao = variacao !== null && variacao !== undefined;
  const isPositivo = temVariacao && variacao >= 0;
  const corBoa = variacaoInvertida ? !isPositivo : isPositivo;

  return (
    <div className={cn(
      "rounded-2xl border shadow-sm p-6",
      "bg-white dark:bg-rv-dark-card",
      "border-rv-forest/10 dark:border-rv-light/10",
      "hover:shadow-md transition-shadow"
    )}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold text-rv-muted dark:text-rv-dark-muted uppercase tracking-widest">
          {label}
        </span>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-rv-mint dark:bg-rv-green/20">
          <Icon className="w-5 h-5 text-rv-green dark:text-rv-vivid" />
        </div>
      </div>
      <p className={cn(
        "text-3xl font-bold tabular-nums font-[var(--font-poppins)]",
        "text-rv-ink dark:text-rv-dark-ink"
      )}>
        {value}
      </p>
      {temVariacao ? (
        <div className="flex items-center gap-1 mt-2">
          {isPositivo ? (
            <ArrowUp className={cn("w-3.5 h-3.5", corBoa ? "text-rv-green" : "text-red-500")} />
          ) : (
            <ArrowDown className={cn("w-3.5 h-3.5", corBoa ? "text-rv-green" : "text-red-500")} />
          )}
          <span className={cn("text-sm font-semibold", corBoa ? "text-rv-green" : "text-red-500")}>
            {Math.abs(variacao as number).toFixed(1)}%
          </span>
          <span className="text-xs text-rv-muted dark:text-rv-dark-muted">{variacaoLabel || "vs mês anterior"}</span>
        </div>
      ) : variacao === null ? (
        <p className="text-xs text-rv-muted dark:text-rv-dark-muted mt-2">Sem dados do mês anterior</p>
      ) : null}
    </div>
  );
}

export default SummaryCard;
