import { createClient } from "@/lib/supabase/server";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { SummaryCards } from "./components/summary-cards";
import { CategoryDonutChart } from "./components/category-donut-chart";
import { RecentTransactions } from "./components/recent-transactions";
import { ForecastChart } from "./components/forecast-chart";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Buscar dados do usuário
  const { data: userData } = await supabase
    .from("users")
    .select("score_saude, renda_mensal")
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

  const { data: transactions, error } = await supabase
    .from("transactions")
    .select("id, data, descricao_raw, categoria, valor, tipo")
    .eq("user_id", user.id)
    .gte("data", inicioMes)
    .lte("data", fimMes)
    .order("data", { ascending: false });

  // Calcular totais
  const totalGastos = transactions
    ?.filter((t) => t.valor < 0)
    .reduce((sum, t) => sum + Math.abs(t.valor), 0) || 0;

  const totalReceitas = transactions
    ?.filter((t) => t.valor > 0)
    .reduce((sum, t) => sum + t.valor, 0) || 0;

  const saldo = totalReceitas - totalGastos;

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

  // Previsão de saldo dos próximos 30 dias
  const hojeStr = hoje.toISOString().split("T")[0];
  const { data: previsoes } = await supabase
    .from("forecasts")
    .select("data_prevista, saldo_projetado, confianca")
    .eq("user_id", user.id)
    .gte("data_prevista", hojeStr)
    .order("data_prevista", { ascending: true })
    .limit(30);

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">Visão geral das suas finanças</p>
      </div>

      <SummaryCards
        saldo={saldo}
        totalGastos={totalGastos}
        totalReceitas={totalReceitas}
        scoreSaude={scoreSaude}
        totalTransacoes={transactions?.length || 0}
      />

      <ForecastChart data={previsoes || []} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CategoryDonutChart data={categoryData} />
        <RecentTransactions transactions={transactions || []} />
      </div>
    </DashboardLayout>
  );
}