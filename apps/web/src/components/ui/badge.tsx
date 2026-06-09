import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info";
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  const variants = {
    default: "bg-gray-100 text-gray-700",
    success: "bg-green-100 text-green-700",
    warning: "bg-yellow-100 text-yellow-700",
    danger: "bg-red-100 text-red-700",
    info: "bg-blue-100 text-blue-700",
  };

  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
      variants[variant],
      className
    )}>
      {children}
    </span>
  );
}

// Badge colorido para categorias financeiras
const categoryColors: Record<string, string> = {
  "Alimentação": "bg-orange-100 text-orange-700",
  "Transporte": "bg-blue-100 text-blue-700",
  "Saúde": "bg-red-100 text-red-700",
  "Moradia": "bg-purple-100 text-purple-700",
  "Lazer": "bg-pink-100 text-pink-700",
  "Educação": "bg-indigo-100 text-indigo-700",
  "Investimentos": "bg-emerald-100 text-emerald-700",
  "Receita": "bg-green-100 text-green-700",
  "Outros": "bg-gray-100 text-gray-700",
  // Status
  "aprovado": "bg-green-100 text-green-700",
  "revisar": "bg-yellow-100 text-yellow-700",
  "pendente": "bg-gray-100 text-gray-700",
};

export function CategoryBadge({ category, className }: { category: string; className?: string }) {
  const colorClass = categoryColors[category] || categoryColors["Outros"];
  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
      colorClass,
      className
    )}>
      {category}
    </span>
  );
}