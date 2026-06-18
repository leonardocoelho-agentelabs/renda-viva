"use client";

import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { createClient } from "@/lib/supabase/client";
import {
  Brain,
  Share2,
  CheckCircle,
  AlertTriangle,
  Lightbulb,
  TrendingUp,
  RefreshCw,
  MessageCircle,
  Copy,
  Check,
  Loader2,
} from "lucide-react";

interface PlanoMelhoria {
  acao: string;
  impacto: "alto" | "medio" | "baixo";
  prazo: "imediato" | "30dias" | "90dias";
}

interface Diagnostico {
  id: string;
  perfil_tipo: string | null;
  perfil_descricao: string | null;
  pontos_fortes: string[];
  pontos_fracos: string[];
  riscos: string[];
  oportunidades: string[];
  plano_melhoria: PlanoMelhoria[];
  frase_diagnostico: string | null;
  score_momento: number | null;
  created_at: string;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getImpactoBadge(impacto: string) {
  switch (impacto) {
    case "alto":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    case "medio":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "baixo":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400";
  }
}

function getPrazoBadge(prazo: string) {
  switch (prazo) {
    case "imediato":
      return "text-red-600 dark:text-red-400";
    case "30dias":
      return "text-yellow-600 dark:text-yellow-400";
    case "90dias":
      return "text-blue-600 dark:text-blue-400";
    default:
      return "text-gray-600 dark:text-gray-400";
  }
}

export default function DiagnosticoPage() {
  const supabase = createClient();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

  const [diagnostico, setDiagnostico] = useState<Diagnostico | null>(null);
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const getToken = useCallback(async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, [supabase]);

  const loadDiagnostico = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        setError("Sessão expirada. Faça login novamente.");
        return;
      }
      const res = await fetch(`${apiUrl}/diagnostico/ultimo`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDiagnostico(data.diagnostico);
      } else if (res.status === 404) {
        setDiagnostico(null);
      }
    } catch {
      setError("Não foi possível carregar o diagnóstico.");
    } finally {
      setLoading(false);
    }
  }, [apiUrl, getToken]);

  useEffect(() => {
    loadDiagnostico();
  }, [loadDiagnostico]);

  const handleGerar = async () => {
    setGerando(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        setError("Sessão expirada. Faça login novamente.");
        return;
      }
      const res = await fetch(`${apiUrl}/diagnostico/gerar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDiagnostico(data.diagnostico);
      } else {
        throw new Error(`Erro ${res.status}`);
      }
    } catch {
      setError("Não foi possível gerar o diagnóstico. Tente novamente.");
    } finally {
      setGerando(false);
    }
  };

  const handleShare = async () => {
    if (!diagnostico) return;

    const texto = `🔬 *Meu Diagnóstico Financeiro — Renda Viva*

*Perfil:* ${diagnostico.perfil_tipo}
${diagnostico.frase_diagnostico}

*Pontos fortes:* ${diagnostico.pontos_fortes?.slice(0, 2).join(", ") || "N/A"}
*Pontos de atenção:* ${diagnostico.pontos_fracos?.slice(0, 2).join(", ") || "N/A"}

💡 Gere o seu em rendavivapp.com`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Meu Diagnóstico Financeiro",
          text: texto,
        });
      } else {
        await navigator.clipboard.writeText(texto);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Usuário cancelou ou erro
    }
  };

  const handleCopyDiagnostico = async () => {
    if (!diagnostico) return;
    const texto = `Diagnóstico Financeiro - ${diagnostico.perfil_tipo}: ${diagnostico.perfil_descricao}`;
    await navigator.clipboard.writeText(texto);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="font-[var(--font-poppins)] font-bold text-2xl text-rv-ink dark:text-[#F0F0F0]">
          Diagnóstico Financeiro
        </h1>
        <p className="text-rv-muted dark:text-[#8A8A8A]">
          Análise completa do seu perfil e plano de melhoria
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="h-12 w-12 rounded-full border-3 border-rv-vivid border-t-transparent animate-spin mb-4" />
          <p className="text-gray-400">Carregando diagnóstico...</p>
        </div>
      ) : !diagnostico ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <span className="text-6xl mb-4">🔬</span>
          <h2 className="text-xl font-semibold text-gray-700 dark:text-[#F0F0F0] mb-2">
            Descubra seu perfil financeiro
          </h2>
          <p className="text-gray-400 dark:text-[#8A8A8A] mb-8 max-w-md">
            Gere uma análise completa do seu comportamento financeiro com dicas
            personalizadas para melhorar sua saúde financeira.
          </p>
          <button
            onClick={handleGerar}
            disabled={gerando}
            className="flex items-center gap-2 px-6 py-3 bg-rv-vivid hover:bg-rv-vivid/90 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {gerando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Gerando análise...
              </>
            ) : (
              <>
                <Brain className="h-4 w-4" />
                Gerar Diagnóstico
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Card Principal do Perfil */}
          <div className="bg-gradient-to-r from-rv-vivid/10 to-purple-500/10 dark:from-rv-vivid/20 dark:to-purple-500/20 border border-rv-vivid/20 dark:border-rv-vivid/30 rounded-2xl overflow-hidden">
            <div className="bg-rv-vivid/10 dark:bg-rv-vivid/20 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-rv-vivid/20 dark:bg-rv-vivid/30 rounded-xl flex items-center justify-center">
                  <Brain className="w-6 h-6 text-rv-vivid" />
                </div>
                <div>
                  <h2 className="font-semibold text-rv-ink dark:text-[#F0F0F0]">
                    PERFIL: {diagnostico.perfil_tipo}
                  </h2>
                  <p className="text-sm text-[#8A8A8A]">
                    Gerado em {formatDate(diagnostico.created_at)}
                  </p>
                </div>
              </div>
              <button
                onClick={handleShare}
                className="flex items-center gap-2 px-4 py-2 bg-rv-vivid hover:bg-rv-vivid/90 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Share2 className="h-4 w-4" />
                    Compartilhar
                  </>
                )}
              </button>
            </div>
            <div className="px-6 py-5">
              <p className="text-rv-ink dark:text-[#F0F0F0] text-lg leading-relaxed mb-4">
                &ldquo;{diagnostico.perfil_descricao}&rdquo;
              </p>
              {diagnostico.frase_diagnostico && (
                <div className="bg-white dark:bg-[#1E1E1E] rounded-xl p-4 border border-white/10 dark:border-white/10">
                  <p className="text-sm text-[#8A8A8A] mb-1">Frase do diagnóstico:</p>
                  <p className="text-rv-vivid font-medium italic">
                    &ldquo;{diagnostico.frase_diagnostico}&rdquo;
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Grid de Pontos Fortes e Fracos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pontos Fortes */}
            <div className="bg-white dark:bg-[#1E1E1E] rounded-xl border border-white/10 dark:border-white/10 p-5">
              <h3 className="font-semibold text-rv-ink dark:text-[#F0F0F0] mb-4 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Pontos Fortes
              </h3>
              <ul className="space-y-3">
                {(diagnostico.pontos_fortes || []).map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[#8A8A8A]">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Pontos Fracos */}
            <div className="bg-white dark:bg-[#1E1E1E] rounded-xl border border-white/10 dark:border-white/10 p-5">
              <h3 className="font-semibold text-rv-ink dark:text-[#F0F0F0] mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                Pontos de Atenção
              </h3>
              <ul className="space-y-3">
                {(diagnostico.pontos_fracos || []).map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[#8A8A8A]">
                    <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full mt-2 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Riscos */}
            <div className="bg-white dark:bg-[#1E1E1E] rounded-xl border border-white/10 dark:border-white/10 p-5">
              <h3 className="font-semibold text-rv-ink dark:text-[#F0F0F0] mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Riscos Identificados
              </h3>
              <ul className="space-y-3">
                {(diagnostico.riscos || []).map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[#8A8A8A]">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full mt-2 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Oportunidades */}
            <div className="bg-white dark:bg-[#1E1E1E] rounded-xl border border-white/10 dark:border-white/10 p-5">
              <h3 className="font-semibold text-rv-ink dark:text-[#F0F0F0] mb-4 flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-blue-500" />
                Oportunidades
              </h3>
              <ul className="space-y-3">
                {(diagnostico.oportunidades || []).map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[#8A8A8A]">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Plano de Melhoria */}
          <div className="bg-white dark:bg-[#1E1E1E] rounded-xl border border-white/10 dark:border-white/10 p-5">
            <h3 className="font-semibold text-rv-ink dark:text-[#F0F0F0] mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-rv-vivid" />
              Plano de Melhoria
            </h3>
            <div className="space-y-4">
              {(diagnostico.plano_melhoria || []).map((plano, i) => (
                <div
                  key={i}
                  className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-[#2A2A2A] rounded-xl"
                >
                  <span className="w-8 h-8 bg-rv-vivid/20 dark:bg-rv-vivid/30 rounded-full flex items-center justify-center text-rv-vivid font-semibold text-sm flex-shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <p className="text-rv-ink dark:text-[#F0F0F0] font-medium mb-2">
                      {plano.acao}
                    </p>
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${getImpactoBadge(
                          plano.impacto
                        )}`}
                      >
                        {plano.impacto.toUpperCase()}
                      </span>
                      <span
                        className={`text-xs font-medium ${getPrazoBadge(plano.prazo)}`}
                      >
                        [{plano.prazo.toUpperCase()}]
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ações */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleGerar}
              disabled={gerando}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-rv-vivid hover:bg-rv-vivid/90 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
            >
              {gerando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Gerar Novo Diagnóstico
                </>
              )}
            </button>
            <button
              onClick={() => {
                window.location.href = "/assistant";
              }}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <MessageCircle className="h-4 w-4" />
              Falar com a Viva
            </button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
