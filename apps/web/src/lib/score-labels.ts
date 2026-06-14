interface DimensaoLabel {
  positivo: string;
  atencao: string;
}

// Chaves correspondem aos nomes EXATOS retornados por GET /api/score/current
// (apps/api/src/modules/score/service.ts).
export const SCORE_DIMENSION_LABELS: Record<string, DimensaoLabel> = {
  "Fluxo de caixa": {
    positivo: "Fluxo de caixa positivo",
    atencao: "Fluxo de caixa apertado",
  },
  "Comportamento de gastos": {
    positivo: "Controle de gastos consistente",
    atencao: "Pouco controle sobre os gastos",
  },
  "Consistência": {
    positivo: "Hábito financeiro consistente",
    atencao: "Registro financeiro irregular",
  },
  "Tendência de gastos": {
    positivo: "Gastos em queda ou estáveis",
    atencao: "Gastos crescendo mês a mês",
  },
  "Diversificação de receita": {
    positivo: "Fontes de renda diversificadas",
    atencao: "Dependência de renda única",
  },
  "Investimentos": {
    positivo: "Investimentos constantes",
    atencao: "Sem investimentos regulares",
  },
};

export function getScoreClassificacao(score: number): { label: string; cor: string } {
  if (score >= 80) return { label: "Excelente", cor: "text-green-600" };
  if (score >= 60) return { label: "Bom", cor: "text-blue-600" };
  if (score >= 40) return { label: "Em desenvolvimento", cor: "text-amber-600" };
  return { label: "Atenção necessária", cor: "text-red-600" };
}
