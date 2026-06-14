import {
  Utensils,
  Car,
  HeartPulse,
  Gamepad2,
  BookOpen,
  Home,
  TrendingUp,
  Wallet,
  Repeat,
  CircleDot,
  type LucideIcon,
} from "lucide-react";

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "Alimentação": Utensils,
  "Transporte": Car,
  "Saúde": HeartPulse,
  "Lazer": Gamepad2,
  "Educação": BookOpen,
  "Moradia": Home,
  "Investimentos": TrendingUp,
  "Receita": Wallet,
  "Assinaturas": Repeat,
  "Outros": CircleDot,
};

export function getCategoryIcon(categoria: string | null | undefined): LucideIcon {
  return (categoria && CATEGORY_ICONS[categoria]) || CATEGORY_ICONS["Outros"];
}
