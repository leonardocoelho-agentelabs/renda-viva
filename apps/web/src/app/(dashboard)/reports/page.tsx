"use client";

import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { createClient } from "@/lib/supabase/client";
import { FileText, Sparkles, X, Download, ChevronDown, ChevronUp, Calculator } from "lucide-react";
import ReactMarkdown from "react-markdown";
import jsPDF from "jspdf";

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface ReportItem {
  mes_ano: string;
  gerado_em: string | null;
}

interface Transacao {
  id: string;
  data: string;
  valor: number;
  descricao_raw: string;
  categoria: string;
  tipo: string;
}

interface AnaliseIA {
  resumo_executivo: string;
  alerta_declaracao: string;
  deducoes_possiveis: {
    saude: { total: number; sem_limite: boolean; observacao: string };
    educacao: { total: number; limite_legal: number; deducao_real: number; observacao: string };
    previdencia_oficial: { total: number; observacao: string };
  };
  total_deducoes: number;
  base_calculo_estimada: number;
  imposto_estimado: number;
  dicas_declaracao: string[];
  documentos_necessarios: string[];
  alertas: string[];
}

interface PorMes {
  [key: string]: { receitas: number; despesas: number; saldo: number };
}

interface RelatorioIR {
  ano: number;
  usuario: { nome: string; cpf_mascarado: string };
  gerado_em: string;
  rendimentos: {
    tributaveis: { total: number; transacoes: Transacao[] };
    isentos: { total: number; transacoes: Transacao[] };
    total_geral: number;
  };
  despesas_dedutiveis: {
    saude: { total: number; transacoes: Transacao[] };
    educacao: { total: number; transacoes: Transacao[] };
    previdencia: { total: number; transacoes: Transacao[] };
    total_geral: number;
  };
  investimentos: {
    aportes: { total: number; transacoes: Transacao[] };
    resgates: { total: number; transacoes: Transacao[] };
    saldo_liquido: number;
  };
  por_mes: PorMes;
  analise_ia: AnaliseIA;
  resumo: {
    total_receitas: number;
    total_despesas: number;
    total_deducoes: number;
    base_calculo: number;
    imposto_estimado: number;
  };
}

// ─── Utilitários ─────────────────────────────────────────────────────────────

function formatarBRL(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(data: string): string {
  return new Date(data + "T00:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatMesAno(mesAno: string): string {
  const [ano, mes] = mesAno.split("-").map(Number);
  const d = new Date(ano, mes - 1, 1);
  const s = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatarNomeMes(key: string): string {
  const [ano, mes] = key.split("-");
  const d = new Date(Number(ano), Number(mes) - 1, 1);
  return d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}

function baixarRelatorioPDF(relatorio: string, mesAno: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const margemEsq = 20;
  const margemDir = 20;
  const larguraUtil = 210 - margemEsq - margemDir;
  let y = 20;

  doc.setFillColor(22, 163, 74);
  doc.rect(0, 0, 210, 35, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Renda Viva", margemEsq, 15);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  const [ano, mes] = mesAno.split("-");
  const nomeMes = new Date(Number(ano), Number(mes) - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  doc.text(`Relatório Financeiro — ${nomeMes}`, margemEsq, 25);

  y = 50;

  doc.setTextColor(0, 0, 0);
  const linhas = relatorio.split("\n");

  for (const linha of linhas) {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }

    const semFences = linha.trim();
    if (semFences.startsWith("**") && semFences.endsWith("**") && semFences.length > 4) {
      const titulo = semFences.replace(/\*\*/g, "");
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(22, 163, 74);
      y += 4;
      doc.text(titulo, margemEsq, y);
      y += 7;
      doc.setTextColor(0, 0, 0);
    } else if (semFences === "") {
      y += 3;
    } else {
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(55, 65, 81);

      const textoLimpo = linha
        .replace(/^#+\s*/, "")
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/\*(.*?)\*/g, "$1");

      const linhasQuebradas = doc.splitTextToSize(textoLimpo, larguraUtil);
      doc.text(linhasQuebradas, margemEsq, y);
      y += linhasQuebradas.length * 5 + 2;
    }
  }

  const totalPaginas = doc.getNumberOfPages();
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(
      `Renda Viva — Relatório gerado em ${new Date().toLocaleDateString("pt-BR")} — Página ${i}/${totalPaginas}`,
      105,
      290,
      { align: "center" }
    );
  }

  doc.save(`relatorio-renda-viva-${mesAno}.pdf`);
}

// ─── Componentes ─────────────────────────────────────────────────────────────

function ReportMarkdown({ content }: { content: string }) {
  return (
    <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="text-lg font-bold text-gray-900 dark:text-[#F8FAFC] mt-4 mb-2">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-semibold text-gray-900 dark:text-[#F8FAFC] mt-4 mb-1.5">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold text-gray-900 dark:text-[#F8FAFC] mt-3 mb-1">{children}</h3>
          ),
          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
          strong: ({ children }) => (
            <strong className="font-semibold text-gray-900 dark:text-[#F8FAFC] block mt-4 mb-1">{children}</strong>
          ),
          ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>,
          li: ({ children }) => <li>{children}</li>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function Accordion({
  title,
  children,
  icon,
  valor,
  badge,
}: {
  title: string;
  children: React.ReactNode;
  icon: React.ReactNode;
  valor?: number;
  badge?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-rv-forest/10 dark:border-white/8 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 bg-rv-page dark:bg-rv-dark-bg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon}
          <span className="font-medium text-rv-ink dark:text-[#F0F0F0]">{title}</span>
          {valor !== undefined && (
            <span className="text-sm text-rv-green dark:text-rv-vivid font-semibold">
              {formatarBRL(valor)}
            </span>
          )}
          {badge}
        </div>
        {open ? (
          <ChevronUp className="h-5 w-5 text-[#8A8A8A]" />
        ) : (
          <ChevronDown className="h-5 w-5 text-[#8A8A8A]" />
        )}
      </button>
      {open && (
        <div className="bg-white dark:bg-rv-dark-card px-5 py-4">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Aba: Relatórios Mensais ─────────────────────────────────────────────────

function RelatoriosMensais() {
  const supabase = createClient();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openReport, setOpenReport] = useState<{ mes_ano: string; relatorio: string } | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  const getToken = useCallback(async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, [supabase]);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        setError("Sessão expirada. Faça login novamente.");
        return;
      }
      const res = await fetch(`${apiUrl}/reports/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const data = await res.json();
      setReports(Array.isArray(data) ? data : []);
    } catch {
      setError("Não foi possível carregar os relatórios.");
    } finally {
      setLoading(false);
    }
  }, [apiUrl, getToken]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        setError("Sessão expirada. Faça login novamente.");
        return;
      }
      const res = await fetch(`${apiUrl}/reports/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const data = await res.json();
      setOpenReport({ mes_ano: data.mes_ano, relatorio: data.relatorio });
      await loadReports();
    } catch {
      setError("Não foi possível gerar o relatório. Tente novamente.");
    } finally {
      setGenerating(false);
    }
  };

  const handleOpen = async (mesAno: string) => {
    setLoadingReport(true);
    setOpenReport({ mes_ano: mesAno, relatorio: "" });
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${apiUrl}/reports/${mesAno}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const data = await res.json();
      setOpenReport({ mes_ano: mesAno, relatorio: data.relatorio });
    } catch {
      setOpenReport(null);
      setError("Não foi possível abrir o relatório.");
    } finally {
      setLoadingReport(false);
    }
  };

  return (
    <>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-[var(--font-poppins)] font-bold text-2xl text-rv-ink dark:text-[#F0F0F0]">Relatórios</h1>
          <p className="text-rv-muted dark:text-[#8A8A8A]">Seu resumo financeiro mensal, narrado pelo Viva</p>
        </div>
        {reports.length > 0 && (
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-rv-green dark:bg-rv-vivid text-white text-sm font-medium hover:bg-rv-forest dark:hover:bg-rv-vivid/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Sparkles className="h-4 w-4" />
            {generating ? "Gerando..." : "Gerar Relatório do Mês"}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="h-10 w-10 rounded-full border-2 border-green-500 border-t-transparent animate-spin mb-4" />
          <p className="text-gray-400">Carregando relatórios...</p>
        </div>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <FileText className="h-16 w-16 text-gray-300 dark:text-[#3a3a3a] mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 dark:text-[#F0F0F0] mb-2">
            Nenhum relatório ainda
          </h2>
          <p className="text-gray-400 dark:text-[#8A8A8A] mb-8 max-w-sm">
            Gere um relatório narrativo do mês passado com base nas suas transações reais.
          </p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Sparkles className="h-4 w-4" />
            {generating ? "Gerando relatório..." : "Gerar primeiro relatório"}
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reports.map((r) => (
            <button
              key={r.mes_ano}
              onClick={() => handleOpen(r.mes_ano)}
              className="text-left bg-white dark:bg-[#1E1E1E] rounded-xl border border-white/8 shadow-sm p-5 hover:shadow-md transition-shadow"
            >
              <div className="w-10 h-10 rounded-lg bg-rv-mint dark:bg-rv-vivid/20 flex items-center justify-center mb-3">
                <FileText className="h-5 w-5 text-rv-green dark:text-rv-vivid" />
              </div>
              <h3 className="font-semibold text-rv-ink dark:text-[#F0F0F0]">{formatMesAno(r.mes_ano)}</h3>
              <p className="text-xs text-[#8A8A8A] mt-1">
                {r.gerado_em
                  ? `Gerado em ${new Date(r.gerado_em).toLocaleDateString("pt-BR")}`
                  : "Relatório disponível"}
              </p>
            </button>
          ))}
        </div>
      )}

      {openReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white dark:bg-[#1E1E1E] rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-rv-green dark:text-rv-vivid" />
                <h2 className="font-[var(--font-poppins)] font-semibold text-lg text-rv-ink dark:text-[#F0F0F0]">
                  {formatMesAno(openReport.mes_ano)}
                </h2>
              </div>
              <button
                onClick={() => setOpenReport(null)}
                className="p-1 rounded hover:bg-white/5 dark:hover:bg-white/5 text-[#8A8A8A]"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-5 overflow-y-auto">
              {loadingReport && !openReport.relatorio ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-8 w-8 rounded-full border-2 border-green-500 border-t-transparent animate-spin" />
                </div>
              ) : (
                <ReportMarkdown content={openReport.relatorio} />
              )}
            </div>
            {openReport.relatorio && (
              <div className="flex gap-3 justify-end px-6 py-4 border-t border-white/5">
                <button
                  onClick={() => baixarRelatorioPDF(openReport.relatorio, openReport.mes_ano)}
                  className="flex items-center gap-2 px-4 py-2 bg-rv-green dark:bg-rv-vivid text-white rounded-lg text-sm font-medium hover:bg-rv-forest dark:hover:bg-rv-vivid/90 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Baixar PDF
                </button>
                <button
                  onClick={() => setOpenReport(null)}
                  className="px-4 py-2 border border-white/10 text-[#8A8A8A] rounded-lg text-sm font-medium hover:bg-white/5 transition-colors"
                >
                  Fechar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Aba: Imposto de Renda ────────────────────────────────────────────────────

function ImpostoDeRenda() {
  const supabase = createClient();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

  const [anoSelecionado, setAnoSelecionado] = useState(() => {
    const anoAtual = new Date().getFullYear();
    return anoAtual - 1;
  });
  const [relatorio, setRelatorio] = useState<RelatorioIR | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [baixando, setBaixando] = useState(false);

  const anosDisponiveis = [2023, 2024, 2025, 2026];

  const getToken = useCallback(async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, [supabase]);

  const gerarRelatorio = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRelatorio(null);

    try {
      const token = await getToken();
      if (!token) {
        setError("Sessão expirada. Faça login novamente.");
        return;
      }

      const res = await fetch(`${apiUrl}/reports/ir/${anoSelecionado}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Erro ${res.status}`);
      }

      const data: RelatorioIR = await res.json();
      setRelatorio(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar relatório");
    } finally {
      setLoading(false);
    }
  }, [apiUrl, anoSelecionado, getToken]);

  const baixarJSON = useCallback(async () => {
    if (!relatorio) return;
    setBaixando(true);

    try {
      const token = await getToken();
      if (!token) return;

      const res = await fetch(`${apiUrl}/reports/ir/${anoSelecionado}/download`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Erro ao baixar");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `IR-${anoSelecionado}-RendaViva.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError("Erro ao baixar relatório");
    } finally {
      setBaixando(false);
    }
  }, [relatorio, apiUrl, anoSelecionado, getToken]);

  const precisaDeclarar = relatorio?.analise_ia.alerta_declaracao.toLowerCase().includes("precisa") ?? false;

  return (
    <>
      <div className="mb-8">
        <h1 className="font-[var(--font-poppins)] font-bold text-2xl text-rv-ink dark:text-[#F0F0F0]">
          Imposto de Renda
        </h1>
        <p className="text-rv-muted dark:text-[#8A8A8A]">
          Relatório anual para facilitar sua declaração de IRPF
        </p>
      </div>

      {/* Seletor de ano e botão gerar */}
      <div className="flex flex-wrap items-center gap-4 mb-8">
        <div className="flex gap-2">
          {anosDisponiveis.map((ano) => (
            <button
              key={ano}
              onClick={() => setAnoSelecionado(ano)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                anoSelecionado === ano
                  ? "bg-rv-green dark:bg-rv-vivid text-white"
                  : "bg-white dark:bg-[#1E1E1E] text-rv-muted hover:text-rv-ink dark:text-[#8A8A8A] dark:hover:text-[#F0F0F0] border border-rv-forest/10 dark:border-white/8"
              }`}
            >
              {ano}
            </button>
          ))}
        </div>

        <button
          onClick={gerarRelatorio}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-rv-green dark:bg-rv-vivid text-white text-sm font-medium hover:bg-rv-forest dark:hover:bg-rv-vivid/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Calculator className="h-4 w-4" />
          {loading ? "Gerando..." : "Gerar relatório de IR →"}
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-10 w-10 rounded-full border-2 border-green-500 border-t-transparent animate-spin mb-4" />
          <p className="text-gray-400">Analisando transações do ano {anoSelecionado}...</p>
        </div>
      )}

      {relatorio && !loading && (
        <div className="space-y-6">
          {/* Banner principal */}
          <div
            className={`rounded-2xl p-6 ${
              precisaDeclarar
                ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                : "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
            }`}
          >
            <div className="flex items-start gap-4">
              <span className="text-3xl">{precisaDeclarar ? "⚠️" : "✅"}</span>
              <div>
                <h2 className="text-lg font-semibold text-rv-ink dark:text-[#F0F0F0] mb-1">
                  Relatório de IR — Ano Base {anoSelecionado}
                </h2>
                <p className={`text-sm ${precisaDeclarar ? "text-red-700 dark:text-red-400" : "text-green-700 dark:text-green-400"}`}>
                  {relatorio.analise_ia.alerta_declaracao}
                </p>
                <p className="text-sm text-rv-muted dark:text-[#8A8A8A] mt-2">
                  {relatorio.analise_ia.resumo_executivo}
                </p>
              </div>
            </div>
          </div>

          {/* Grid de 4 cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-white dark:bg-rv-dark-card border border-rv-forest/10 dark:border-white/8 rounded-2xl p-5">
              <p className="text-xs text-[#8A8A8A] mb-1">RENDIMENTOS TRIBUTÁVEIS</p>
              <p className="text-xl font-bold text-rv-green">{formatarBRL(relatorio.rendimentos.tributaveis.total)}</p>
              <p className="text-xs text-[#8A8A8A] mt-1">{relatorio.rendimentos.tributaveis.transacoes.length} transações</p>
            </div>

            <div className="bg-white dark:bg-rv-dark-card border border-rv-forest/10 dark:border-white/8 rounded-2xl p-5">
              <p className="text-xs text-[#8A8A8A] mb-1">DEDUÇÕES POSSÍVEIS</p>
              <p className="text-xl font-bold text-rv-green">{formatarBRL(relatorio.analise_ia.total_deducoes)}</p>
              <p className="text-xs text-[#8A8A8A] mt-1">Saúde + Educação + Prev.</p>
            </div>

            <div className="bg-white dark:bg-rv-dark-card border border-rv-forest/10 dark:border-white/8 rounded-2xl p-5">
              <p className="text-xs text-[#8A8A8A] mb-1">BASE DE CÁLCULO</p>
              <p className="text-xl font-bold text-rv-ink dark:text-[#F0F0F0]">{formatarBRL(relatorio.analise_ia.base_calculo_estimada)}</p>
              <p className="text-xs text-[#8A8A8A] mt-1">Após deduções</p>
            </div>

            <div className="bg-white dark:bg-rv-dark-card border border-rv-forest/10 dark:border-white/8 rounded-2xl p-5">
              <p className="text-xs text-[#8A8A8A] mb-1">IMPOSTO ESTIMADO</p>
              <p className="text-xl font-bold text-amber-600">{formatarBRL(relatorio.analise_ia.imposto_estimado)}</p>
              <p className="text-xs text-[#8A8A8A] mt-1">Estimativa IRPF</p>
            </div>
          </div>

          {/* Seções detalhadas */}
          <div className="space-y-3">
            {/* Rendimentos Tributáveis */}
            <Accordion
              title="Rendimentos Tributáveis"
              icon={<span className="text-lg">💰</span>}
              valor={relatorio.rendimentos.tributaveis.total}
            >
              {relatorio.rendimentos.tributaveis.transacoes.length === 0 ? (
                <p className="text-sm text-[#8A8A8A]">Nenhum rendimento tributável identificado.</p>
              ) : (
                <div className="space-y-2">
                  {relatorio.rendimentos.tributaveis.transacoes.slice(0, 10).map((t) => (
                    <div key={t.id} className="flex justify-between items-center text-sm py-1 border-b border-gray-100 dark:border-white/5 last:border-0">
                      <div>
                        <span className="text-rv-ink dark:text-[#F0F0F0]">{t.descricao_raw || t.categoria}</span>
                        <span className="text-[#8A8A8A] ml-2">{formatarData(t.data)}</span>
                      </div>
                      <span className="text-rv-green font-medium">{formatarBRL(t.valor)}</span>
                    </div>
                  ))}
                  {relatorio.rendimentos.tributaveis.transacoes.length > 10 && (
                    <p className="text-xs text-[#8A8A8A] pt-2">
                      + {relatorio.rendimentos.tributaveis.transacoes.length - 10} mais transações
                    </p>
                  )}
                </div>
              )}
            </Accordion>

            {/* Despesas de Saúde */}
            <Accordion
              title="Despesas de Saúde — Dedutíveis"
              icon={<span className="text-lg">🏥</span>}
              valor={relatorio.despesas_dedutiveis.saude.total}
              badge={
                <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">
                  SEM LIMITE
                </span>
              }
            >
              <p className="text-sm text-[#8A8A8A] mb-4">Despesas de saúde não têm limite de dedução.</p>
              {relatorio.despesas_dedutiveis.saude.transacoes.length === 0 ? (
                <p className="text-sm text-[#8A8A8A]">Nenhuma despesa de saúde identificada.</p>
              ) : (
                <div className="space-y-2">
                  {relatorio.despesas_dedutiveis.saude.transacoes.map((t) => (
                    <div key={t.id} className="flex justify-between items-center text-sm py-1 border-b border-gray-100 dark:border-white/5 last:border-0">
                      <div>
                        <span className="text-rv-ink dark:text-[#F0F0F0]">{t.descricao_raw || t.categoria}</span>
                        <span className="text-[#8A8A8A] ml-2">{formatarData(t.data)}</span>
                      </div>
                      <span className="text-rv-ink dark:text-[#F0F0F0] font-medium">{formatarBRL(Math.abs(t.valor))}</span>
                    </div>
                  ))}
                </div>
              )}
            </Accordion>

            {/* Despesas de Educação */}
            <Accordion
              title="Despesas de Educação"
              icon={<span className="text-lg">📚</span>}
              valor={relatorio.despesas_dedutiveis.educacao.total}
              badge={
                <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full">
                  LIMITE: {formatarBRL(relatorio.analise_ia.deducoes_possiveis.educacao.limite_legal)}
                </span>
              }
            >
              <p className="text-sm text-[#8A8A8A] mb-4">
                {relatorio.analise_ia.deducoes_possiveis.educacao.observacao}
              </p>
              {relatorio.despesas_dedutiveis.educacao.transacoes.length === 0 ? (
                <p className="text-sm text-[#8A8A8A]">Nenhuma despesa de educação identificada.</p>
              ) : (
                <div className="space-y-2">
                  {relatorio.despesas_dedutiveis.educacao.transacoes.map((t) => (
                    <div key={t.id} className="flex justify-between items-center text-sm py-1 border-b border-gray-100 dark:border-white/5 last:border-0">
                      <div>
                        <span className="text-rv-ink dark:text-[#F0F0F0]">{t.descricao_raw || t.categoria}</span>
                        <span className="text-[#8A8A8A] ml-2">{formatarData(t.data)}</span>
                      </div>
                      <span className="text-rv-ink dark:text-[#F0F0F0] font-medium">{formatarBRL(Math.abs(t.valor))}</span>
                    </div>
                  ))}
                </div>
              )}
            </Accordion>

            {/* Previdência */}
            <Accordion
              title="Previdência Social"
              icon={<span className="text-lg">💼</span>}
              valor={relatorio.despesas_dedutiveis.previdencia.total}
            >
              <p className="text-sm text-[#8A8A8A] mb-4">
                {relatorio.analise_ia.deducoes_possiveis.previdencia_oficial.observacao}
              </p>
              {relatorio.despesas_dedutiveis.previdencia.transacoes.length === 0 ? (
                <p className="text-sm text-[#8A8A8A]">Nenhuma contribuição de previdência identificada.</p>
              ) : (
                <div className="space-y-2">
                  {relatorio.despesas_dedutiveis.previdencia.transacoes.map((t) => (
                    <div key={t.id} className="flex justify-between items-center text-sm py-1 border-b border-gray-100 dark:border-white/5 last:border-0">
                      <div>
                        <span className="text-rv-ink dark:text-[#F0F0F0]">{t.descricao_raw || t.categoria}</span>
                        <span className="text-[#8A8A8A] ml-2">{formatarData(t.data)}</span>
                      </div>
                      <span className="text-rv-ink dark:text-[#F0F0F0] font-medium">{formatarBRL(Math.abs(t.valor))}</span>
                    </div>
                  ))}
                </div>
              )}
            </Accordion>

            {/* Investimentos */}
            <Accordion
              title="Investimentos"
              icon={<span className="text-lg">📈</span>}
              valor={relatorio.investimentos.saldo_liquido}
            >
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-50 dark:bg-white/5 rounded-lg p-3">
                  <p className="text-xs text-[#8A8A8A]">Aportes</p>
                  <p className="text-sm font-semibold text-rv-ink dark:text-[#F0F0F0]">{formatarBRL(relatorio.investimentos.aportes.total)}</p>
                  <p className="text-xs text-[#8A8A8A]">{relatorio.investimentos.aportes.transacoes.length} transações</p>
                </div>
                <div className="bg-gray-50 dark:bg-white/5 rounded-lg p-3">
                  <p className="text-xs text-[#8A8A8A]">Resgates</p>
                  <p className="text-sm font-semibold text-rv-ink dark:text-[#F0F0F0]">{formatarBRL(relatorio.investimentos.resgates.total)}</p>
                  <p className="text-xs text-[#8A8A8A]">{relatorio.investimentos.resgates.transacoes.length} transações</p>
                </div>
              </div>
              <p className="text-sm font-medium text-rv-ink dark:text-[#F0F0F0]">
                Saldo líquido: {formatarBRL(relatorio.investimentos.saldo_liquido)}
              </p>
            </Accordion>

            {/* Evolução Mensal */}
            <Accordion
              title="Evolução Mensal"
              icon={<span className="text-lg">📅</span>}
              valor={undefined}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-white/10">
                      <th className="text-left py-2 text-[#8A8A8A] font-medium">Mês</th>
                      <th className="text-right py-2 text-[#8A8A8A] font-medium">Receitas</th>
                      <th className="text-right py-2 text-[#8A8A8A] font-medium">Despesas</th>
                      <th className="text-right py-2 text-[#8A8A8A] font-medium">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(relatorio.por_mes)
                      .filter(([_, v]) => v.receitas > 0 || v.despesas > 0)
                      .map(([mes, valores]) => (
                        <tr key={mes} className="border-b border-gray-100 dark:border-white/5">
                          <td className="py-2 text-rv-ink dark:text-[#F0F0F0]">{formatarNomeMes(mes)}</td>
                          <td className="py-2 text-right text-rv-green">{formatarBRL(valores.receitas)}</td>
                          <td className="py-2 text-right text-rv-ink dark:text-[#F0F0F0]">{formatarBRL(valores.despesas)}</td>
                          <td className={`py-2 text-right font-medium ${valores.saldo >= 0 ? "text-rv-green" : "text-red-500"}`}>
                            {formatarBRL(valores.saldo)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </Accordion>
          </div>

          {/* Dicas da IA */}
          {relatorio.analise_ia.dicas_declaracao.length > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-6">
              <h3 className="flex items-center gap-2 font-semibold text-rv-ink dark:text-[#F0F0F0] mb-4">
                💡 Dicas para sua declaração
              </h3>
              <ul className="space-y-2">
                {relatorio.analise_ia.dicas_declaracao.map((dica, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-blue-800 dark:text-blue-300">
                    <span>✓</span>
                    <span>{dica}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Documentos Necessários */}
          {relatorio.analise_ia.documentos_necessarios.length > 0 && (
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-2xl p-6">
              <h3 className="flex items-center gap-2 font-semibold text-rv-ink dark:text-[#F0F0F0] mb-4">
                📂 Documentos que você vai precisar
              </h3>
              <ul className="space-y-2">
                {relatorio.analise_ia.documentos_necessarios.map((doc, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-purple-800 dark:text-purple-300">
                    <span>□</span>
                    <span>{doc}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Botões de ação */}
          <div className="flex flex-wrap gap-4 pt-4">
            <button
              onClick={baixarJSON}
              disabled={baixando}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-rv-green dark:bg-rv-vivid text-white text-sm font-medium hover:bg-rv-forest dark:hover:bg-rv-vivid/90 disabled:opacity-50 transition-colors"
            >
              <Download className="h-4 w-4" />
              {baixando ? "Baixando..." : "Baixar relatório JSON"}
            </button>
          </div>

          {/* Aviso legal */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-300">
            <p className="font-medium mb-1">⚠️ Aviso Legal</p>
            <p>
              Este relatório é uma estimativa baseada nas suas transações registradas no Renda Viva.
              Consulte um contador para sua declaração oficial. Valores podem divergir dos informes
              oficiais dos empregadores e instituições financeiras.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<"mensais" | "ir">("mensais");

  return (
    <DashboardLayout>
      {/* Tabs */}
      <div className="flex gap-2 mb-8 border-b border-gray-200 dark:border-white/10 pb-4">
        <button
          onClick={() => setActiveTab("mensais")}
          className={`px-5 py-2 rounded-xl text-sm font-medium transition-colors ${
            activeTab === "mensais"
              ? "bg-rv-green dark:bg-rv-vivid text-white"
              : "text-rv-muted hover:text-rv-ink dark:text-[#8A8A8A] dark:hover:text-[#F0F0F0]"
          }`}
        >
          Relatórios Mensais
        </button>
        <button
          onClick={() => setActiveTab("ir")}
          className={`px-5 py-2 rounded-xl text-sm font-medium transition-colors ${
            activeTab === "ir"
              ? "bg-rv-green dark:bg-rv-vivid text-white"
              : "text-rv-muted hover:text-rv-ink dark:text-[#8A8A8A] dark:hover:text-[#F0F0F0]"
          }`}
        >
          Imposto de Renda
        </button>
      </div>

      {/* Conteúdo da aba */}
      {activeTab === "mensais" ? <RelatoriosMensais /> : <ImpostoDeRenda />}
    </DashboardLayout>
  );
}
