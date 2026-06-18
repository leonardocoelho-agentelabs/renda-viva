"use client";

import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { createClient } from "@/lib/supabase/client";
import { Zap, TrendingUp, MessageCircle } from "lucide-react";
import Link from "next/link";
import jsPDF from "jspdf";

interface SimulationResult {
  id: string;
  tipo: string;
  parametros: {
    valor: number;
    parcelas: number;
    valor_parcela: number;
    taxa_juros_mensal: number;
    economia_mensal: number;
  };
  impacto_1_ano: {
    saldo_acumulado: number;
    total_pago: number;
    percentual_renda_comprometido: number;
    meses_para_quitar: number;
    resumo: string;
  };
  impacto_2_anos: {
    saldo_acumulado: number;
    total_pago: number;
    percentual_renda_comprometido: number;
    resumo: string;
  };
  impacto_5_anos: {
    saldo_acumulado: number;
    total_pago: number;
    custo_oportunidade: number;
    resumo: string;
  };
  viabilidade: "viavel" | "atencao" | "critico";
  resumo_geral: string;
  recomendacao: string;
  alternativas: string[];
  alertas: string[];
  created_at: string;
}

interface HistoryItem {
  id: string;
  pergunta_original: string;
  tipo: string;
  viabilidade: string;
  resumo: string;
  created_at: string;
}

const EXEMPLOS = [
  { icon: "💳", texto: "Financiar carro R$40k/60x" },
  { icon: "📱", texto: "Parcelar iPhone em 12x" },
  { icon: "🏠", texto: "Entrada de imóvel R$50k" },
  { icon: "✂️", texto: "Cancelar assinaturas" },
  { icon: "📈", texto: "Investir R$500/mês" },
];

const LOADING_MESSAGES = [
  "Analisando seu perfil financeiro...",
  "Calculando impacto em 1, 2 e 5 anos...",
  "Comparando com custo de oportunidade...",
  "Gerando recomendações personalizadas...",
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getViabilidadeBadge(viabilidade: string) {
  switch (viabilidade) {
    case "viavel":
      return {
        bg: "bg-rv-mint/20",
        text: "text-rv-forest",
        label: "VIÁVEL",
        icon: "🟢",
      };
    case "atencao":
      return {
        bg: "bg-amber-50",
        text: "text-amber-700",
        label: "ATENÇÃO",
        icon: "🟡",
      };
    case "critico":
      return {
        bg: "bg-red-50",
        text: "text-red-700",
        label: "CUIDADO",
        icon: "🔴",
      };
    default:
      return {
        bg: "bg-gray-100",
        text: "text-gray-700",
        label: viabilidade.toUpperCase(),
        icon: "⚪",
      };
  }
}

function getTipoIcon(tipo: string): string {
  switch (tipo) {
    case "financiamento":
      return "💳";
    case "investimento":
      return "📈";
    case "cancelamento":
      return "✂️";
    case "compra":
      return "🛒";
    case "mudanca_renda":
      return "💰";
    default:
      return "📊";
  }
}

export default function SimuladorPage() {
  const [pergunta, setPergunta] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [resultado, setResultado] = useState<SimulationResult | null>(null);
  const [historico, setHistorico] = useState<HistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingHistorico, setLoadingHistorico] = useState<string | null>(null);
  const loadingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const supabase = createClient();

  // Carregar histórico ao iniciar
  useEffect(() => {
    loadHistorico();
  }, []);

  // Rotação de mensagens de loading
  useEffect(() => {
    if (loading) {
      loadingIntervalRef.current = setInterval(() => {
        setLoadingMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
      }, 2000);
    } else {
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current);
      }
    }
    return () => {
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current);
      }
    };
  }, [loading]);

  const loadHistorico = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
      const response = await fetch(`${apiUrl}/simulator/history`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setHistorico(data.simulations || []);
      }
    } catch (error) {
      console.error("Erro ao carregar histórico:", error);
    }
  };

  const abrirSimulacao = async (id: string) => {
    setLoadingHistorico(id);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
      const response = await fetch(`${apiUrl}/simulator/${id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!response.ok) {
        throw new Error("Erro ao carregar simulação");
      }

      const json = await response.json();
      if (json.success) {
        const sim = json.simulation;
        setPergunta(sim.pergunta_original || sim.pergunta);
        setResultado({
          id: sim.id,
          tipo: sim.tipo,
          parametros: sim.parametros || {
            valor: sim.valor || 0,
            parcelas: sim.parcelas || 0,
            valor_parcela: sim.valor_parcela || 0,
            taxa_juros_mensal: sim.taxa_juros || 0,
            economia_mensal: sim.economia_mensal || 0,
          },
          impacto_1_ano: sim.impacto_1_ano || {
            saldo_acumulado: sim.saldo_acumulado || 0,
            total_pago: sim.total_pago || 0,
            percentual_renda_comprometido: sim.percentual_renda_comprometido || 0,
            meses_para_quitar: sim.meses_para_quitar || 0,
            resumo: sim.resumo_1_ano || sim.resumo || "",
          },
          impacto_2_anos: sim.impacto_2_anos || {
            saldo_acumulado: 0,
            total_pago: 0,
            percentual_renda_comprometido: 0,
            resumo: sim.resumo_2_anos || "",
          },
          impacto_5_anos: sim.impacto_5_anos || {
            saldo_acumulado: 0,
            total_pago: 0,
            custo_oportunidade: 0,
            resumo: sim.resumo_5_anos || "",
          },
          viabilidade: sim.viabilidade || "viavel",
          resumo_geral: sim.resumo_geral || sim.resumo || "",
          recomendacao: sim.recomendacao || "",
          alternativas: sim.alternativas || [],
          alertas: sim.alertas || [],
          created_at: sim.created_at,
        });

        // Scroll para o resultado
        setTimeout(() => {
          document.getElementById("resultado-simulacao")?.scrollIntoView({
            behavior: "smooth",
          });
        }, 100);
      }
    } catch (err) {
      console.error("Erro ao abrir simulação:", err);
      setError("Erro ao carregar simulação do histórico");
    } finally {
      setLoadingHistorico(null);
    }
  };

  const handleExemploClick = (texto: string) => {
    setPergunta(texto);
  };

  const handleSimular = async () => {
    if (!pergunta.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResultado(null);
    setLoadingMessageIndex(0);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setError("Sessão expirada. Por favor, faça login novamente.");
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
      const response = await fetch(`${apiUrl}/simulator/simulate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ pergunta }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erro ao simular");
      }

      const data = await response.json();
      setResultado(data.simulation);

      // Recarregar histórico
      loadHistorico();
    } catch (error) {
      console.error("Erro na simulação:", error);
      setError(error instanceof Error ? error.message : "Erro ao processar simulação");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && e.ctrlKey) {
      e.preventDefault();
      handleSimular();
    }
  };

  const novaSimulacao = () => {
    setPergunta("");
    setResultado(null);
    setError(null);
  };

  const badge = resultado ? getViabilidadeBadge(resultado.viabilidade) : null;

  return (
    <DashboardLayout>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rv-mint dark:bg-rv-green/20 flex items-center justify-center">
            <Zap className="w-5 h-5 text-rv-green dark:text-rv-vivid" />
          </div>
          <div>
            <h1 className="font-[var(--font-poppins)] font-bold text-2xl text-rv-ink dark:text-[#F0F0F0]">
              Simulador Financeiro
            </h1>
            <p className="text-rv-muted dark:text-[#8A8A8A]">
              Descreva qualquer cenário e veja o impacto real no seu dinheiro.
            </p>
          </div>
        </div>
      </div>

      {/* Área de Input */}
      <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-white/8 shadow-sm p-6 mb-6">
        <label className="block text-sm font-medium text-rv-ink dark:text-[#F0F0F0] mb-2">
          O que você quer simular?
        </label>
        <textarea
          value={pergunta}
          onChange={(e) => setPergunta(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Ex: "Posso financiar um carro de R$40.000 em 60 meses?" ou "E se eu cancelar a academia e Netflix?" ou "Quanto rende R$500/mês no Tesouro em 5 anos?"`}
          disabled={loading}
          className="w-full min-h-[100px] p-4 border border-rv-forest/20 dark:border-white/10 rounded-xl text-rv-ink dark:text-[#F0F0F0] bg-transparent dark:bg-[#2A2A2A] placeholder:text-rv-muted/70 dark:placeholder:text-[#8A8A8A] focus:outline-none focus:ring-2 focus:ring-rv-green focus:border-rv-green resize-none disabled:opacity-60"
        />

        {/* Chips de exemplo */}
        <div className="flex flex-wrap gap-2 mt-4">
          {EXEMPLOS.map((exemplo, index) => (
            <button
              key={index}
              onClick={() => handleExemploClick(exemplo.texto)}
              disabled={loading}
              className="bg-rv-mint/50 dark:bg-rv-green/10 border border-rv-forest/15 dark:border-white/10 text-rv-forest dark:text-rv-vivid hover:bg-rv-mint dark:hover:bg-rv-green/20 rounded-full px-4 py-2 text-sm cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exemplo.icon} {exemplo.texto}
            </button>
          ))}
        </div>

        {/* Botão de simulação */}
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-rv-muted dark:text-[#8A8A8A]">
            Ctrl + Enter para enviar
          </span>
          <button
            onClick={handleSimular}
            disabled={loading || !pergunta.trim()}
            className="bg-rv-green hover:bg-rv-forest dark:bg-rv-vivid dark:hover:bg-rv-green text-white font-[var(--font-poppins)] font-semibold rounded-xl px-6 py-3 flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Zap className="w-4 h-4" />
            Simular agora
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-white/8 shadow-sm p-12 mb-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-rv-mint/30 dark:bg-rv-green/20 flex items-center justify-center">
            <Zap className="w-8 h-8 text-rv-green dark:text-rv-vivid animate-pulse" />
          </div>
          <p className="text-rv-ink dark:text-[#F0F0F0] font-medium animate-pulse">
            {LOADING_MESSAGES[loadingMessageIndex]}
          </p>
        </div>
      )}

      {/* Erro */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Resultado */}
      {resultado && badge && (
        <div id="resultado-simulacao" className="space-y-6 mb-8">
          {/* Badge de viabilidade */}
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${badge.bg} ${badge.text}`}>
            <span>{badge.icon}</span>
            <span className="font-semibold text-sm">{badge.label}</span>
          </div>

          {/* Card principal do resultado */}
          <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-white/8 shadow-sm p-6">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-rv-mint/30 dark:bg-rv-green/20 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">{getTipoIcon(resultado.tipo)}</span>
              </div>
              <div>
                <h2 className="font-semibold text-lg text-rv-ink dark:text-[#F0F0F0] mb-1">
                  Resultado da Simulação
                </h2>
                <p className="text-rv-muted dark:text-[#8A8A8A] text-sm">
                  &ldquo;{pergunta}&rdquo;
                </p>
              </div>
            </div>

            {/* Parâmetros */}
            {resultado.parametros.valor > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-rv-mint/10 dark:bg-rv-green/10 rounded-xl">
                {resultado.parametros.valor_parcela > 0 && (
                  <div>
                    <p className="text-xs text-rv-muted dark:text-[#8A8A8A] mb-1">Parcela estimada</p>
                    <p className="font-semibold text-rv-ink dark:text-[#F0F0F0]">
                      {formatCurrency(resultado.parametros.valor_parcela)}/mês
                    </p>
                  </div>
                )}
                {resultado.parametros.taxa_juros_mensal > 0 && (
                  <div>
                    <p className="text-xs text-rv-muted dark:text-[#8A8A8A] mb-1">Taxa de juros</p>
                    <p className="font-semibold text-rv-ink dark:text-[#F0F0F0]">
                      {resultado.parametros.taxa_juros_mensal.toFixed(2)}% a.m.
                    </p>
                  </div>
                )}
                {resultado.parametros.economia_mensal > 0 && (
                  <div>
                    <p className="text-xs text-rv-muted dark:text-[#8A8A8A] mb-1">Economia mensal</p>
                    <p className="font-semibold text-green-600 dark:text-green-400">
                      {formatCurrency(resultado.parametros.economia_mensal)}
                    </p>
                  </div>
                )}
                {resultado.parametros.parcelas > 0 && (
                  <div>
                    <p className="text-xs text-rv-muted dark:text-[#8A8A8A] mb-1">Parcelas</p>
                    <p className="font-semibold text-rv-ink dark:text-[#F0F0F0]">
                      {resultado.parametros.parcelas}x
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Cards de impacto */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {/* 1 Ano */}
              <div className="bg-white dark:bg-[#2A2A2A] border border-rv-forest/10 dark:border-white/8 rounded-2xl p-5">
                <h3 className="font-semibold text-rv-ink dark:text-[#F0F0F0] mb-3 flex items-center gap-2">
                  <span className="text-lg">📅</span> 1 ANO
                </h3>
                <div className="space-y-2">
                  {resultado.impacto_1_ano.total_pago > 0 && (
                    <div>
                      <p className="text-xs text-rv-muted dark:text-[#8A8A8A]">Total pago</p>
                      <p className="font-bold text-lg text-rv-ink dark:text-[#F0F0F0]">
                        {formatCurrency(resultado.impacto_1_ano.total_pago)}
                      </p>
                    </div>
                  )}
                  {resultado.impacto_1_ano.percentual_renda_comprometido > 0 && (
                    <div>
                      <p className="text-xs text-rv-muted dark:text-[#8A8A8A]">Renda comprometida</p>
                      <p className="font-bold text-lg text-amber-600 dark:text-amber-400">
                        {resultado.impacto_1_ano.percentual_renda_comprometido.toFixed(0)}%
                      </p>
                    </div>
                  )}
                  {resultado.impacto_1_ano.saldo_acumulado !== 0 && (
                    <div>
                      <p className="text-xs text-rv-muted dark:text-[#8A8A8A]">Saldo acumulado</p>
                      <p className="font-semibold text-rv-ink dark:text-[#F0F0F0]">
                        {formatCurrency(resultado.impacto_1_ano.saldo_acumulado)}
                      </p>
                    </div>
                  )}
                  <p className="text-sm text-rv-muted dark:text-[#8A8A8A] mt-3 pt-2 border-t border-rv-forest/10 dark:border-white/5">
                    {resultado.impacto_1_ano.resumo}
                  </p>
                </div>
              </div>

              {/* 2 Anos */}
              <div className="bg-white dark:bg-[#2A2A2A] border border-rv-forest/10 dark:border-white/8 rounded-2xl p-5">
                <h3 className="font-semibold text-rv-ink dark:text-[#F0F0F0] mb-3 flex items-center gap-2">
                  <span className="text-lg">📅</span> 2 ANOS
                </h3>
                <div className="space-y-2">
                  {resultado.impacto_2_anos.total_pago > 0 && (
                    <div>
                      <p className="text-xs text-rv-muted dark:text-[#8A8A8A]">Total pago</p>
                      <p className="font-bold text-lg text-rv-ink dark:text-[#F0F0F0]">
                        {formatCurrency(resultado.impacto_2_anos.total_pago)}
                      </p>
                    </div>
                  )}
                  {resultado.impacto_2_anos.percentual_renda_comprometido > 0 && (
                    <div>
                      <p className="text-xs text-rv-muted dark:text-[#8A8A8A]">Renda comprometida</p>
                      <p className="font-bold text-lg text-amber-600 dark:text-amber-400">
                        {resultado.impacto_2_anos.percentual_renda_comprometido.toFixed(0)}%
                      </p>
                    </div>
                  )}
                  {resultado.impacto_2_anos.saldo_acumulado !== 0 && (
                    <div>
                      <p className="text-xs text-rv-muted dark:text-[#8A8A8A]">Saldo acumulado</p>
                      <p className="font-semibold text-rv-ink dark:text-[#F0F0F0]">
                        {formatCurrency(resultado.impacto_2_anos.saldo_acumulado)}
                      </p>
                    </div>
                  )}
                  <p className="text-sm text-rv-muted dark:text-[#8A8A8A] mt-3 pt-2 border-t border-rv-forest/10 dark:border-white/5">
                    {resultado.impacto_2_anos.resumo}
                  </p>
                </div>
              </div>

              {/* 5 Anos */}
              <div className="bg-white dark:bg-[#2A2A2A] border border-rv-forest/10 dark:border-white/8 rounded-2xl p-5">
                <h3 className="font-semibold text-rv-ink dark:text-[#F0F0F0] mb-3 flex items-center gap-2">
                  <span className="text-lg">📅</span> 5 ANOS
                </h3>
                <div className="space-y-2">
                  {resultado.impacto_5_anos.total_pago > 0 && (
                    <div>
                      <p className="text-xs text-rv-muted dark:text-[#8A8A8A]">Total pago</p>
                      <p className="font-bold text-lg text-rv-ink dark:text-[#F0F0F0]">
                        {formatCurrency(resultado.impacto_5_anos.total_pago)}
                      </p>
                    </div>
                  )}
                  {resultado.impacto_5_anos.custo_oportunidade > 0 && (
                    <div>
                      <p className="text-xs text-rv-muted dark:text-[#8A8A8A]">Custo oportunidade</p>
                      <p className="font-bold text-lg text-red-600 dark:text-red-400">
                        {formatCurrency(resultado.impacto_5_anos.custo_oportunidade)}
                      </p>
                    </div>
                  )}
                  {resultado.impacto_5_anos.saldo_acumulado !== 0 && (
                    <div>
                      <p className="text-xs text-rv-muted dark:text-[#8A8A8A]">Saldo acumulado</p>
                      <p className="font-semibold text-green-600 dark:text-green-400">
                        {formatCurrency(resultado.impacto_5_anos.saldo_acumulado)}
                      </p>
                    </div>
                  )}
                  <p className="text-sm text-rv-muted dark:text-[#8A8A8A] mt-3 pt-2 border-t border-rv-forest/10 dark:border-white/5">
                    {resultado.impacto_5_anos.resumo}
                  </p>
                </div>
              </div>
            </div>

            {/* Alertas */}
            {resultado.alertas && resultado.alertas.length > 0 && (
              <div className={`mb-6 p-4 rounded-xl ${badge.bg}`}>
                <h4 className={`font-semibold text-sm ${badge.text} mb-2`}>
                  ⚠️ {resultado.viabilidade === "critico" ? "ALERTA CRÍTICO" : "ATENÇÃO"}
                </h4>
                <ul className="space-y-1">
                  {resultado.alertas.map((alerta, index) => (
                    <li key={index} className={`text-sm ${badge.text}`}>
                      • {alerta}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Resumo geral */}
            <div className="mb-6 p-4 bg-rv-mint/10 dark:bg-rv-green/10 rounded-xl">
              <p className="text-rv-ink dark:text-[#F0F0F0]">
                {resultado.resumo_geral}
              </p>
            </div>

            {/* Recomendação */}
            <div className="mb-6">
              <h4 className="font-semibold text-rv-ink dark:text-[#F0F0F0] mb-2 flex items-center gap-2">
                💡 RECOMENDAÇÃO
              </h4>
              <p className="text-rv-muted dark:text-[#8A8A8A]">
                {resultado.recomendacao}
              </p>
            </div>

            {/* Alternativas */}
            {resultado.alternativas && resultado.alternativas.length > 0 && (
              <div className="mb-6">
                <h4 className="font-semibold text-rv-ink dark:text-[#F0F0F0] mb-2 flex items-center gap-2">
                  🔄 ALTERNATIVAS
                </h4>
                <ul className="space-y-2">
                  {resultado.alternativas.map((alt, index) => (
                    <li key={index} className="flex items-start gap-2 text-rv-muted dark:text-[#8A8A8A]">
                      <span>•</span>
                      <span>{alt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Ações */}
            <div className="flex flex-wrap gap-3 pt-4 border-t border-rv-forest/10 dark:border-white/5">
              <button
                onClick={novaSimulacao}
                className="px-4 py-2 text-sm border border-rv-forest/20 dark:border-white/10 text-rv-ink dark:text-[#F0F0F0] rounded-lg hover:bg-rv-mint/10 dark:hover:bg-white/5 transition-colors"
              >
                🔄 Nova simulação
              </button>
              <Link
                href="/assistant"
                className="px-4 py-2 text-sm bg-rv-green dark:bg-rv-vivid text-white rounded-lg hover:bg-rv-forest dark:hover:bg-rv-green transition-colors flex items-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                Perguntar à Viva
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Histórico */}
      {historico.length > 0 && !resultado && (
        <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-white/8 shadow-sm p-6">
          <h3 className="font-semibold text-rv-ink dark:text-[#F0F0F0] mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Suas últimas simulações
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {historico.slice(0, 6).map((item) => {
              const itemBadge = getViabilidadeBadge(item.viabilidade);
              return (
                <div
                  key={item.id}
                  onClick={() => abrirSimulacao(item.id)}
                  className="p-3 bg-rv-mint/10 dark:bg-rv-green/10 rounded-xl hover:bg-rv-mint/20 dark:hover:bg-rv-green/15 transition-colors cursor-pointer border border-transparent hover:border-rv-green dark:hover:border-rv-vivid"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-lg">{getTipoIcon(item.tipo)}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${itemBadge.bg} ${itemBadge.text}`}>
                      {itemBadge.icon} {itemBadge.label}
                    </span>
                  </div>
                  <p className="text-sm text-rv-ink dark:text-[#F0F0F0] line-clamp-2 mb-2">
                    {item.pergunta_original}
                  </p>
                  <p className="text-xs text-rv-muted dark:text-[#8A8A8A] flex items-center gap-2">
                    {formatDate(item.created_at)}
                    {loadingHistorico === item.id && (
                      <span className="text-rv-green dark:text-rv-vivid">Carregando...</span>
                    )}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
