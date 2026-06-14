import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { getCategoryColor } from "@/lib/category-colors";

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

// Badge colorido para categorias financeiras — usa a paleta compartilhada
export function CategoryBadge({ category, className }: { category: string; className?: string }) {
  const cor = getCategoryColor(category);
  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
      cor.bg,
      cor.text,
      className
    )}>
      {category}
    </span>
  );
}