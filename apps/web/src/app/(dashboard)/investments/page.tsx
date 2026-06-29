"use client";

import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { createClient } from "@/lib/supabase/client";
import { TrendingUp, RefreshCw, Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Oportunidade {
  titulo: string;
  tipo: string;
  ticker?: string | null;
  retornoAnual: string;
  risco: "baixo" | "medio" | "alto";
  valorMinimo: string;
  prazo: string;
  justificativa: string;
  ideal_para: string;
}

interface FII {
  ticker: string;
  nome: string;
  segmento: string;
  dividendYield: number;
  pvp: number;
  precoAtual: number;
  ultimoDividendo: number;
  liquidezDiaria: number;
}

interface AcaoB3 {
  ticker: string;
  nome: string;
  setor: string;
  precoAtual: number;
  dividendYield: number;
  pl: number;
  variacao12m: number;
}

interface Mercado {
  selic: number;
  ipca: number;
  cdi: number;
  tesouroDireto: Array<{
    nome: string;
    vencimento: string;
    taxaAnual: number;
    precoMinimo: number;
  }>;
  fiis: FII[];
  acoes: AcaoB3[];
  coletadoEm: string;
}

interface RadarData {
  oportunidades: Oportunidade[];
  mercado: Mercado;
}

const RISCO_BADGE: Record<string, string> = {
  baixo: "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400",
  medio: "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400",
  alto: "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400",
};

const RISCO_DOT: Record<string, string> = {
  baixo: "🟢",
  medio: "🟡",
  alto: "🔴",
};

export default function InvestmentsPage() {
  const supabase = createClient();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

  const [data, setData] = useState<RadarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getToken = useCallback(async (): Promise<string | null> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, [supabase]);

  const loadRadar = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const token = await getToken();
        if (!token) {
          setError("Sessão expirada. Faça login novamente.");
          return;
        }
        const res = await fetch(
          `${apiUrl}/investments/radar${refresh ? "?refresh=true" : ""}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) throw new Error(`Erro ${res.status}`);
        const json = await res.json();
        setData(json);
      } catch {
        setError("Não foi possível carregar o radar de investimentos.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [apiUrl, getToken]
  );

  useEffect(() => {
    loadRadar(false);
  }, [loadRadar]);

  const handleSendWhatsApp = async () => {
    setSending(true);
    setToast(null);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${apiUrl}/investments/radar/send-whatsapp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      setToast(json.enviado ? "Radar enviado por WhatsApp! ✅" : "Não foi possível enviar agora.");
    } catch {
      setToast("Erro ao enviar por WhatsApp.");
    } finally {
      setSending(false);
      setTimeout(() => setToast(null), 4000);
    }
  };

  const mercadoCards = data
    ? [
        { label: "Selic", value: `${data.mercado.selic}%`, sub: "ao ano" },
        { label: "IPCA", value: `${data.mercado.ipca}%`, sub: "ao mês" },
        { label: "CDI", value: `${data.mercado.cdi}%`, sub: "ao ano" },
      ]
    : [];

  // Separa oportunidades por categoria
  const rendaFixa = data?.oportunidades.filter((o) =>
    ["Tesouro Direto", "CDB", "LCI", "LCA"].includes(o.tipo)
  );
  const fiisOportunidades = data?.oportunidades.filter((o) => o.tipo === "FII");
  const acoesOportunidades = data?.oportunidades.filter((o) => o.tipo === "Ação");

  return (
    <DashboardLayout>
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-[var(--font-poppins)] font-bold text-2xl text-rv-ink dark:text-[#F0F0F0]">Radar de Investimentos</h1>
            <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-rv-mint dark:bg-rv-vivid/20 text-rv-green dark:text-rv-vivid">
              Atualizado domingo
            </span>
          </div>
          <p className="text-rv-muted dark:text-[#8A8A8A]">Curadoria semanal personalizada para o seu perfil</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => loadRadar(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white/10 text-[#8A8A8A] text-sm font-medium hover:bg-white/5 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            Atualizar Radar
          </button>
          <button
            onClick={handleSendWhatsApp}
            disabled={sending || loading || !data?.oportunidades.length}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-rv-green dark:bg-rv-vivid text-white text-sm font-medium hover:bg-rv-forest dark:hover:bg-rv-vivid/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="h-4 w-4" />
            {sending ? "Enviando..." : "Enviar por WhatsApp"}
          </button>
        </div>
      </div>

      {toast && (
        <div className="mb-6 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          {toast}
        </div>
      )}
      {error && (
        <div className="mb-6 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="h-10 w-10 rounded-full border-2 border-rv-green dark:border-rv-vivid border-t-transparent animate-spin mb-4" />
          <p className="text-rv-muted">Analisando o mercado e o seu perfil...</p>
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* Dados de mercado */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {mercadoCards.map((c) => (
              <div
                key={c.label}
                className="bg-white dark:bg-[#1E1E1E] rounded-xl border border-white/8 shadow-sm p-5"
              >
                <span className="text-xs font-medium text-[#8A8A8A] uppercase tracking-wide">
                  {c.label}
                </span>
                <p className="text-2xl font-bold text-rv-ink dark:text-[#F0F0F0] mt-2 font-[var(--font-poppins)]">{c.value}</p>
                <p className="text-xs text-[#8A8A8A] mt-0.5">{c.sub}</p>
              </div>
            ))}
          </div>

          {/* Oportunidades - Renda Fixa */}
          {rendaFixa && rendaFixa.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-[#8A8A8A] uppercase tracking-wide mb-3 flex items-center gap-2">
                🏦 Renda Fixa
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rendaFixa.map((op, i) => (
                  <OportunidadeCard key={`rf-${i}`} oportunidade={op} />
                ))}
              </div>
            </div>
          )}

          {/* Oportunidades - FIIs */}
          {fiisOportunidades && fiisOportunidades.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-[#8A8A8A] uppercase tracking-wide mb-3 flex items-center gap-2">
                🏢 Fundos Imobiliários
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {fiisOportunidades.map((op, i) => (
                  <OportunidadeCard key={`fii-${i}`} oportunidade={op} />
                ))}
              </div>
            </div>
          )}

          {/* Oportunidades - Ações */}
          {acoesOportunidades && acoesOportunidades.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-[#8A8A8A] uppercase tracking-wide mb-3 flex items-center gap-2">
                📈 Ações B3
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {acoesOportunidades.map((op, i) => (
                  <OportunidadeCard key={`acao-${i}`} oportunidade={op} />
                ))}
              </div>
            </div>
          )}

          {/* Fallback: todas as oportunidades */}
          {(!rendaFixa?.length && !fiisOportunidades?.length && !acoesOportunidades?.length) && data.oportunidades.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.oportunidades.map((op, i) => (
                <OportunidadeCard key={`all-${i}`} oportunidade={op} />
              ))}
            </div>
          )}

          {/* FIIs disponíveis */}
          {data.mercado.fiis && data.mercado.fiis.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-[#8A8A8A] uppercase tracking-wide mb-3 flex items-center gap-2">
                🏢 FIIs em destaque
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {data.mercado.fiis.slice(0, 5).map((fii) => (
                  <div
                    key={fii.ticker}
                    className="bg-white dark:bg-[#1E1E1E] rounded-xl border border-white/8 shadow-sm p-3"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-bold text-rv-green dark:text-rv-vivid text-sm">
                        {fii.ticker}
                      </span>
                      <span className="text-xs text-[#8A8A8A]">{fii.segmento}</span>
                    </div>
                    <p className="text-xs text-rv-muted dark:text-[#8A8A8A] truncate">{fii.nome}</p>
                    <div className="mt-2 flex justify-between">
                      <div>
                        <span className="text-xs text-[#8A8A8A]">DY</span>
                        <p className="text-sm font-bold text-rv-ink dark:text-[#F0F0F0]">{fii.dividendYield.toFixed(1)}%</p>
                      </div>
                      <div>
                        <span className="text-xs text-[#8A8A8A]">P/VP</span>
                        <p className="text-sm font-bold text-rv-ink dark:text-[#F0F0F0]">{fii.pvp.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ações disponíveis */}
          {data.mercado.acoes && data.mercado.acoes.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-[#8A8A8A] uppercase tracking-wide mb-3 flex items-center gap-2">
                📈 Ações B3
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {data.mercado.acoes.slice(0, 4).map((acao) => (
                  <div
                    key={acao.ticker}
                    className="bg-white dark:bg-[#1E1E1E] rounded-xl border border-white/8 shadow-sm p-3"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-bold text-rv-green dark:text-rv-vivid text-sm">
                        {acao.ticker}
                      </span>
                      <span className="text-xs text-[#8A8A8A]">{acao.setor}</span>
                    </div>
                    <p className="text-xs text-rv-muted dark:text-[#8A8A8A] truncate">{acao.nome}</p>
                    <div className="mt-2 flex justify-between">
                      <div>
                        <span className="text-xs text-[#8A8A8A]">Preço</span>
                        <p className="text-sm font-bold text-rv-ink dark:text-[#F0F0F0]">
                          R$ {acao.precoAtual.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-[#8A8A8A]">DY</span>
                        <p className="text-sm font-bold text-rv-ink dark:text-[#F0F0F0]">
                          {acao.dividendYield.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.oportunidades.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-white dark:bg-[#1E1E1E] rounded-xl border border-white/8 shadow-sm">
              <TrendingUp className="h-12 w-12 text-[#3a3a3a] mb-3" />
              <p className="text-[#8A8A8A]">Nenhuma recomendação disponível no momento.</p>
              <p className="text-sm text-[#8A8A8A] mt-1">Tente atualizar o radar em instantes.</p>
            </div>
          )}

          <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Curadoria gerada por IA com base em dados do Banco Central, Tesouro Direto, Status Invest e BRAPI. Não é
            recomendação de investimento.
          </p>
        </div>
      ) : null}
    </DashboardLayout>
  );
}

function OportunidadeCard({ oportunidade }: { oportunidade: Oportunidade }) {
  return (
    <div className="bg-white dark:bg-[#1E1E1E] rounded-xl border border-white/8 shadow-sm p-5 flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <span className="text-xs font-medium text-[#8A8A8A]">{oportunidade.tipo}</span>
          <h3 className="font-semibold text-rv-ink dark:text-[#F0F0F0] leading-tight">{oportunidade.titulo}</h3>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className={cn(
              "text-xs font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap",
              RISCO_BADGE[oportunidade.risco] || RISCO_BADGE.medio
            )}
          >
            {RISCO_DOT[oportunidade.risco] || "🟡"} {oportunidade.risco}
          </span>
          {oportunidade.ticker && (
            <span className="bg-rv-mint dark:bg-rv-vivid/20 text-rv-green dark:text-rv-vivid text-xs font-mono font-bold px-2 py-0.5 rounded">
              {oportunidade.ticker}
            </span>
          )}
        </div>
      </div>

      <p className="text-2xl font-bold text-rv-green dark:text-rv-vivid font-[var(--font-poppins)]">{oportunidade.retornoAnual}</p>

      <div className="flex items-center gap-3 text-xs text-[#8A8A8A] mt-2 mb-3">
        <span>💰 {oportunidade.valorMinimo}</span>
        <span>⏱️ {oportunidade.prazo}</span>
      </div>

      <p className="text-sm text-[#8A8A8A] flex-1">{oportunidade.justificativa}</p>

      {oportunidade.ideal_para && (
        <div className="mt-4 pt-3 border-t border-white/5">
          <span className="inline-block text-xs font-medium px-2.5 py-1 rounded-lg bg-rv-mint dark:bg-rv-vivid/20 text-rv-green dark:text-rv-vivid">
            ✨ Ideal para você
          </span>
          <p className="text-xs text-[#8A8A8A] mt-1.5">{oportunidade.ideal_para}</p>
        </div>
      )}
    </div>
  );
}
