"use client";

import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { createClient } from "@/lib/supabase/client";
import { FileText, Sparkles, X, Download } from "lucide-react";
import ReactMarkdown from "react-markdown";
import jsPDF from "jspdf";

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

interface ReportItem {
  mes_ano: string;
  gerado_em: string | null;
}

function formatMesAno(mesAno: string): string {
  const [ano, mes] = mesAno.split("-").map(Number);
  const d = new Date(ano, mes - 1, 1);
  const s = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

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

export default function ReportsPage() {
  const supabase = createClient();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [openReport, setOpenReport] = useState<{ mes_ano: string; relatorio: string } | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  const getToken = useCallback(async (): Promise<string | null> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
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
    <DashboardLayout>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-[#F8FAFC]">Relatórios</h1>
          <p className="text-gray-500 dark:text-[#94A3B8]">Seu resumo financeiro mensal, narrado pelo Viva</p>
        </div>
        {reports.length > 0 && (
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
          <FileText className="h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Nenhum relatório ainda
          </h2>
          <p className="text-gray-400 dark:text-gray-500 mb-8 max-w-sm">
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
              className="text-left bg-white dark:bg-[#111827] rounded-xl border border-gray-100 dark:border-[#1E293B] shadow-sm p-5 hover:shadow-md transition-shadow"
            >
              <div className="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center mb-3">
                <FileText className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-[#F8FAFC]">{formatMesAno(r.mes_ano)}</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {r.gerado_em
                  ? `Gerado em ${new Date(r.gerado_em).toLocaleDateString("pt-BR")}`
                  : "Relatório disponível"}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* Modal do relatório */}
      {openReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white dark:bg-[#111827] rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-[#1E293B]">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-green-600 dark:text-green-400" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-[#F8FAFC]">
                  {formatMesAno(openReport.mes_ano)}
                </h2>
              </div>
              <button
                onClick={() => setOpenReport(null)}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-[#1E293B] text-gray-400 dark:text-gray-500"
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
              <div className="flex gap-3 justify-end px-6 py-4 border-t border-gray-100 dark:border-[#1E293B]">
                <button
                  onClick={() => baixarRelatorioPDF(openReport.relatorio, openReport.mes_ano)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Baixar PDF
                </button>
                <button
                  onClick={() => setOpenReport(null)}
                  className="px-4 py-2 border border-gray-200 dark:border-[#1E293B] text-gray-600 dark:text-gray-400 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-[#1E293B] transition-colors"
                >
                  Fechar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
