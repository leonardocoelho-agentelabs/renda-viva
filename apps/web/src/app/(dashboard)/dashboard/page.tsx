import { Wallet, TrendingDown, Heart, ArrowLeftRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { DashboardHeader } from "./components/dashboard-header";
import { SummaryCard } from "./components/summary-card";
import { CategoryDonutChart } from "./components/category-donut-chart";
import { RecentTransactions } from "./components/recent-transactions";
import { ForecastChart } from "./components/forecast-chart";
import { InsightsPanel } from "./components/insights-panel";
import { FinancialHealthPanel } from "./components/financial-health-panel";
import { CommitmentsPanel } from "./components/CommitmentsPanel";
import { ModoCrisePanel } from "./components/ModoCrisePanel";
import { UpcomingPaymentsCard } from "./components/UpcomingPaymentsCard";
import { LeaksPreviewCard } from "./components/LeaksPreviewCard";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function calcularVariacao(atual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Buscar dados do usuário
  const { data: userData } = await supabase
    .from("users")
    .select("score_saude, renda_mensal, full_name, modo_crise")
    .eq("id", user.id)
    .single();

  // Buscar score atualizado via API (recalcula com base nos dados atuais).
  // Fallback para o valor persistido caso a API não responda.
  let scoreSaude = userData?.score_saude || 0;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
      const res = await fetch(`${apiUrl}/score/current`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.score === "number") scoreSaude = data.score;
      }
    }
  } catch {
    // mantém o fallback
  }

  // Buscar transações do mês atual - usando gte/lte para filtro de data preciso
  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split("T")[0];
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split("T")[0];

  // Buscar TODAS as transações para calcular o saldo atual (sem filtro de data)
  const { data: todasTransacoes } = await supabase
    .from("transactions")
    .select("id, data, descricao_raw, categoria, valor, tipo");

  const { data: transactions, error } = await supabase
    .from("transactions")
    .select("id, data, descricao_raw, categoria, valor, tipo")
    .eq("user_id", user.id)
    .gte("data", inicioMes)
    .lte("data", fimMes)
    .order("data", { ascending: false });

  // Calcular SALDO ATUAL = soma de TODAS as transações (inclui saldo anterior ao período importado)
  const saldoAtual = todasTransacoes
    ?.reduce((sum, t) => sum + Number(t.valor), 0) || 0;

  // Calcular totais do mês
  const totalGastos = transactions
    ?.filter((t) => t.valor < 0)
    .reduce((sum, t) => sum + Math.abs(t.valor), 0) || 0;

  const totalReceitas = transactions
    ?.filter((t) => t.valor > 0)
    .reduce((sum, t) => sum + t.valor, 0) || 0;

  const saldoMes = totalReceitas - totalGastos;

  // Dados do mês anterior (para variação) - soma de TODAS as transações até o fim do mês anterior
  const mesAnteriorInicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
    .toISOString()
    .split("T")[0];
  const mesAnteriorFim = new Date(hoje.getFullYear(), hoje.getMonth(), 0)
    .toISOString()
    .split("T")[0];

  const { data: transacoesAnterior } = await supabase
    .from("transactions")
    .select("valor, categoria")
    .eq("user_id", user.id)
    .lt("data", inicioMes);  // Todas as transações ANTES do mês atual

  const saldoAnterior = transacoesAnterior?.reduce((s, t) => s + t.valor, 0) || 0;
  const gastosAnterior =
    transacoesAnterior?.filter((t) => t.valor < 0).reduce((s, t) => s + Math.abs(t.valor), 0) || 0;

  // Média de gastos dos últimos 3 meses (para a mensagem do cabeçalho)
  const tresMesesInicio = new Date(hoje.getFullYear(), hoje.getMonth() - 3, 1)
    .toISOString()
    .split("T")[0];
  const { data: transacoesTresMeses } = await supabase
    .from("transactions")
    .select("valor")
    .eq("user_id", user.id)
    .gte("data", tresMesesInicio)
    .lt("data", inicioMes);

  const gastosTresMeses =
    transacoesTresMeses?.filter((t) => t.valor < 0).reduce((s, t) => s + Math.abs(t.valor), 0) || 0;
  const gastosMediaTresMeses = gastosTresMeses / 3;

  // Agrupar gastos por categoria para o gráfico
  const porCategoria = transactions
    ?.filter((t) => t.valor < 0 && t.categoria)
    .reduce((acc, t) => {
      const cat = t.categoria || "Outros";
      acc[cat] = (acc[cat] || 0) + Math.abs(t.valor);
      return acc;
    }, {} as Record<string, number>) || {};

  const categoryData = Object.entries(porCategoria)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  return (
    <DashboardLayout>
      {userData?.modo_crise && (
        <ModoCrisePanel
          totalEntradas={totalReceitas}
          totalGastos={totalGastos}
          saldo={saldoAtual}
        />
      )}

      {/* Cabeçalho */}
      <DashboardHeader
        nome={userData?.full_name || ""}
        saldoAtual={saldoAtual}
        gastosAtual={totalGastos}
        gastosMediaTresMeses={gastosMediaTresMeses}
      />

      {/* Visão Geral */}
      <h2 className="text-xs font-semibold tracking-widest uppercase text-rv-muted dark:text-rv-dark-muted mb-3">
        Visão Geral
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <SummaryCard
          label="Saldo atual"
          value={formatCurrency(saldoAtual)}
          variacao={calcularVariacao(saldoAtual, saldoAnterior)}
          icon={Wallet}
          tooltip="Soma de todas as transações registradas, incluindo o saldo anterior ao período importado."
        />
        <SummaryCard
          label="Total de gastos"
          value={formatCurrency(totalGastos)}
          variacao={calcularVariacao(totalGastos, gastosAnterior)}
          icon={TrendingDown}
          variacaoInvertida
        />
        <SummaryCard
          label="Score de saúde"
          value={`${scoreSaude}/100`}
          icon={Heart}
        />
        <SummaryCard
          label="Transações"
          value={`${transactions?.length || 0}`}
          icon={ArrowLeftRight}
        />
      </div>

      {/* Fluxo de Caixa */}
      <h2 className="text-xs font-semibold tracking-widest uppercase text-rv-muted dark:text-rv-dark-muted mb-3">
        Fluxo de Caixa
      </h2>
      <div className="mb-6">
        <ForecastChart />
      </div>

      {/* Compromissos */}
      <h2 className="text-xs font-semibold tracking-widest uppercase text-rv-muted dark:text-rv-dark-muted mb-3">
        Compromissos
      </h2>
      <div className="mb-6">
        <CommitmentsPanel />
      </div>

      <div className="mb-6">
        <UpcomingPaymentsCard />
      </div>

      {/* Análise */}
      <h2 className="text-xs font-semibold tracking-widest uppercase text-rv-muted dark:text-rv-dark-muted mb-3">
        Análise
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <InsightsPanel />
        <FinancialHealthPanel />
      </div>

      {/* Detalhes */}
      <h2 className="text-xs font-semibold tracking-widest uppercase text-rv-muted dark:text-rv-dark-muted mb-3">
        Detalhes
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <CategoryDonutChart data={categoryData} />
        <RecentTransactions transactions={transactions || []} />
      </div>

      {/* Vazamentos */}
      <LeaksPreviewCard />
    </DashboardLayout>
  );
}
