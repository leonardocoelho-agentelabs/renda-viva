export const CATEGORY_COLORS: Record<string, { bg: string; text: string; hex: string }> = {
  "Alimentação": { bg: "bg-orange-50", text: "text-orange-700", hex: "#F97316" },
  "Transporte": { bg: "bg-blue-50", text: "text-blue-700", hex: "#3B82F6" },
  "Saúde": { bg: "bg-red-50", text: "text-red-700", hex: "#EF4444" },
  "Lazer": { bg: "bg-purple-50", text: "text-purple-700", hex: "#A855F7" },
  "Educação": { bg: "bg-pink-50", text: "text-pink-700", hex: "#EC4899" },
  "Moradia": { bg: "bg-amber-50", text: "text-amber-700", hex: "#F59E0B" },
  "Investimentos": { bg: "bg-indigo-50", text: "text-indigo-700", hex: "#6366F1" },
  "Receita": { bg: "bg-green-50", text: "text-green-700", hex: "#16a34a" },
  "Assinaturas": { bg: "bg-cyan-50", text: "text-cyan-700", hex: "#06B6D4" },
  "Outros": { bg: "bg-gray-100", text: "text-gray-600", hex: "#9CA3AF" },
};

export function getCategoryColor(categoria: string | null | undefined) {
  return (categoria && CATEGORY_COLORS[categoria]) || CATEGORY_COLORS["Outros"];
}
