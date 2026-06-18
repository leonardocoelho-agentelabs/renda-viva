"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Droplets,
  CreditCard,
  Coffee,
  ShoppingBag,
  Building2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/layout/dashboard-layout";

interface Vazamento {
  nome: string;
  categoria: string;
  total_periodo: number;
  quantidade_vezes: number;
  media_por_ocorrencia: number;
  frequencia: string;
  tipo: string;
  nivel_alerta: string;
  sugestao: string;
  economia_anual_potencial: number;
}

interface AnalysisResult {
  vazamentos: Vazamento[];
  total_vazamentos: number;
  economia_anual_total: number;
  categoria_mais_vazamentos: string;
  insight_principal: string;
  periodo: number;
  data_analise: string;
}

const PERIODOS = [
  { label: "30 dias", value: 30 },
  { label: "60 dias", value: 60 },
  { label: "90 dias", value: 90 },
  { label: "6 meses", value: 180 },
];

const LOADING_MESSAGES = [
  "Vasculhando seus gastos dos últimos 90 dias...",
  "Identificando padrões invisíveis...",
  "Calculando economia potencial...",
  "Gerando recomendações personalizadas...",
];

const TIPO_ICONS: Record<string, typeof CreditCard> = {
  assinatura_esquecida: CreditCard,
  habito: Coffee,
  conveniencia: ShoppingBag,
  taxa_bancaria: Building2,
  outro: AlertCircle,
};

const NIVEL_CORES: Record<string, { border: string; bg: string; badge: string; dot: string }> = {
  alto: {
    border: "border-red-200 dark:border-red-800",
    bg: "bg-red-50/50 dark:bg-red-950/10",
    badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    dot: "bg-red-500",
  },
  medio: {
    border: "border-amber-200 dark:border-amber-800",
    bg: "bg-amber-50/50 dark:bg-amber-950/10",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  baixo: {
    border: "border-rv-forest/20 dark:border-white/10",
    bg: "bg-rv-forest/5 dark:bg-white/5",
    badge: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    dot: "bg-gray-400",
  },
};

const NIVEL_LABELS: Record<string, string> = {
  alto: "🔴 ALTO",
  medio: "🟡 MÉDIO",
  baixo: "⚪ BAIXO",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatFrequencia(frequencia: string): string {
  const labels: Record<string, string> = {
    diario: "diário",
    semanal: "semanal",
    quinzenal: "quinzenal",
    mensal: "mensal",
    irregular: "irregular",
  };
  return labels[frequencia] || frequencia;
}

function VazamentoCard({ vazamento }: { vazamento: Vazamento }) {
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();
  const cores = NIVEL_CORES[vazamento.nivel_alerta] || NIVEL_CORES.baixo;
  const Icon = TIPO_ICONS[vazamento.tipo] || AlertCircle;

  const handleAskViva = () => {
    router.push(
      `/assistant?context=Analisei%20meus%20vazamentos%20financeiros%20e%20quero%20ajuda%20para%20reduzir%20gastos%20com%20${encodeURIComponent(vazamento.categoria)}`
    );
  };

  return (
    <div
      className={`bg-white dark:bg-rv-dark-card rounded-2xl border ${cores.border} ${cores.bg} p-5 transition-all`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${cores.dot} mt-1.5`} />
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cores.badge}`}>
                {NIVEL_LABELS[vazamento.nivel_alerta]}
              </span>
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Icon className="w-4 h-4 text-rv-forest dark:text-rv-mint" />
              {vazamento.nome}
            </h3>
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
        >
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </button>
      </div>

      {/* Info principal */}
      <div className="space-y-1 mb-4">
        <p className="text-gray-900 dark:text-white font-medium">
          {formatCurrency(vazamento.total_periodo)} em {vazamento.quantidade_vezes}{" "}
          {vazamento.quantidade_vezes === 1 ? "vez" : "vezes"}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          média {formatCurrency(vazamento.media_por_ocorrencia)} por ocorrência
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
          Frequência: {formatFrequencia(vazamento.frequencia)}
        </p>
      </div>

      {/* Economia potencial */}
      <div className="bg-rv-mint/20 dark:bg-rv-green/10 rounded-xl p-3 mb-4">
        <p className="text-sm text-rv-green dark:text-rv-mint font-medium">
          💰 Economia anual potencial: {formatCurrency(vazamento.economia_anual_potencial)}
        </p>
      </div>

      {/* Expandido */}
      {expanded && (
        <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-white/10">
          <div className="bg-rv-soft/10 dark:bg-white/5 rounded-xl p-4">
            <p className="text-sm text-gray-600 dark:text-gray-300 italic">
              💡 {vazamento.sugestao}
            </p>
          </div>

          <button
            onClick={handleAskViva}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-rv-forest/10 hover:bg-rv-forest/20 dark:bg-rv-vivid/10 dark:hover:bg-rv-vivid/20 text-rv-forest dark:text-rv-vivid rounded-xl font-medium transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            💬 Pedir ajuda à Viva
          </button>
        </div>
      )}
    </div>
  );
}

function InsightCard({ insight }: { insight: string }) {
  return (
    <div className="bg-rv-forest/5 dark:bg-rv-vivid/10 border border-rv-forest/20 dark:border-rv-vivid/20 rounded-2xl p-5">
      <div className="flex items-start gap-3">
        <span className="text-2xl">🧠</span>
        <div>
          <h3 className="font-semibold text-rv-forest dark:text-rv-vivid mb-2">
            Insight da Viva
          </h3>
          <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
            {insight}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function VazamentosPage() {
  const [periodo, setPeriodo] = useState(90);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();
  const router = useRouter();

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    // Rotacionar mensagens de loading
    const messageInterval = setInterval(() => {
      setLoadingMessage((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2000);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Não autenticado");
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
      const response = await fetch(`${apiUrl}/leaks/analyze?periodo=${periodo}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erro ao analisar vazamentos");
      }

      const data = await response.json();
      setResult(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      clearInterval(messageInterval);
      setLoading(false);
    }
  };

  const handleTalkToViva = () => {
    const categoria = result?.categoria_mais_vazamentos || "gastos gerais";
    router.push(
      `/assistant?context=Analisei%20meus%20vazamentos%20financeiros%20e%20quero%20ajuda%20para%20reduzir%20gastos%20com%20${encodeURIComponent(categoria)}`
    );
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Cabeçalho */}
        <div className="text-center py-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 flex items-center justify-center gap-3">
            <Droplets className="w-8 h-8 text-blue-500" />
            Mapa de Vazamentos Financeiros
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Descubra os pequenos gastos invisíveis que estão drenando seu dinheiro todo mês.
          </p>
        </div>

        {/* Seletor de período */}
        <div className="flex justify-center">
          <div className="inline-flex bg-white dark:bg-rv-dark-card rounded-xl p-1.5 border border-gray-200 dark:border-white/10">
            {PERIODOS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriodo(p.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  periodo === p.value
                    ? "bg-rv-green text-white shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Botão analisar */}
        <div className="flex justify-center">
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="px-8 py-3 bg-rv-green hover:bg-rv-green/90 disabled:bg-rv-green/50 text-white font-semibold rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-rv-green/20"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <span className="text-lg">🔍</span>
            )}
            {loading ? "Analisando..." : "Analisar meus gastos"}
          </button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="bg-white dark:bg-rv-dark-card rounded-2xl border border-gray-200 dark:border-white/10 p-8 text-center">
            <Loader2 className="w-12 h-12 text-rv-green animate-spin mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              {LOADING_MESSAGES[loadingMessage]}
            </p>
          </div>
        )}

        {/* Erro */}
        {error && (
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-2xl p-4">
            <p className="text-red-600 dark:text-red-400 text-center">{error}</p>
          </div>
        )}

        {/* Resultado */}
        {result && !loading && (
          <div className="space-y-6">
            {/* Banner de impacto */}
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl">🚨</span>
                <h2 className="text-xl font-bold text-red-700 dark:text-red-400">
                  Encontramos {formatCurrency(result.total_vazamentos)} em vazamentos
                </h2>
              </div>
              <p className="text-red-600/80 dark:text-red-400/80 mb-4">
                nos últimos {result.periodo} dias
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white/50 dark:bg-black/20 rounded-xl p-4">
                  <p className="text-sm text-red-600/70 dark:text-red-400/70">
                    Economia anual potencial
                  </p>
                  <p className="text-2xl font-bold text-red-700 dark:text-red-400">
                    {formatCurrency(result.economia_anual_total)}
                  </p>
                </div>
                <div className="bg-white/50 dark:bg-black/20 rounded-xl p-4">
                  <p className="text-sm text-red-600/70 dark:text-red-400/70">
                    Categoria com mais vazamentos
                  </p>
                  <p className="text-xl font-bold text-red-700 dark:text-red-400 capitalize">
                    {result.categoria_mais_vazamentos || "N/A"}
                  </p>
                </div>
              </div>
            </div>

            {/* Insight principal */}
            {result.insight_principal && (
              <InsightCard insight={result.insight_principal} />
            )}

            {/* Lista de vazamentos */}
            {result.vazamentos.length > 0 ? (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Vazamentos identificados ({result.vazamentos.length})
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {result.vazamentos.map((vazamento, index) => (
                    <VazamentoCard key={index} vazamento={vazamento} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-rv-dark-card rounded-2xl border border-gray-200 dark:border-white/10 p-8 text-center">
                <span className="text-4xl mb-4 block">✅</span>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Nenhum vazamento significativo encontrado
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Continue monitorando seus gastos para manter o controle!
                </p>
              </div>
            )}

            {/* Resumo de economia */}
            {result.vazamentos.length > 0 && (
              <div className="bg-rv-mint/20 dark:bg-rv-green/10 border border-rv-forest/20 dark:border-white/10 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">💰</span>
                  <h3 className="text-lg font-semibold text-rv-forest dark:text-rv-mint">
                    Se você agir em todos os vazamentos:
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white/50 dark:bg-black/20 rounded-xl p-4 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Economia mensal</p>
                    <p className="text-xl font-bold text-rv-forest dark:text-rv-mint">
                      {formatCurrency(result.economia_anual_total / 12)}
                    </p>
                  </div>
                  <div className="bg-white/50 dark:bg-black/20 rounded-xl p-4 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Economia anual</p>
                    <p className="text-xl font-bold text-rv-forest dark:text-rv-mint">
                      {formatCurrency(result.economia_anual_total)}
                    </p>
                  </div>
                  <div className="bg-white/50 dark:bg-black/20 rounded-xl p-4 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Em 5 anos*</p>
                    <p className="text-xl font-bold text-rv-forest dark:text-rv-mint">
                      {formatCurrency(result.economia_anual_total * 5 * 1.1)}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      * considerando rendimento de 10% a.a.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Botão falar com Viva */}
            <div className="flex justify-center pt-4">
              <button
                onClick={handleTalkToViva}
                className="px-6 py-3 bg-rv-vivid hover:bg-rv-vivid/90 text-white font-semibold rounded-xl transition-all flex items-center gap-2"
              >
                <MessageCircle className="w-5 h-5" />
                Falar com a Viva sobre isso
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
