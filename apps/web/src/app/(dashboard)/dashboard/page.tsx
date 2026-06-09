import { createClient } from "@/lib/supabase/server";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { SummaryCards } from "./components/summary-cards";
import { CategoryChart } from "./components/category-chart";
import { RecentTransactions } from "./components/recent-transactions";
import { startOfMonth, endOfMonth, format } from "date-fns";

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

  // Buscar transações do mês atual
  const now = new Date();
  const mesAtual = format(now, "yyyy-MM");

  const { data: transactions } = await supabase
    .from("transactions")
    .select("id, data, descricao_raw, categoria, valor, tipo")
    .eq("user_id", user.id)
    .like("data", `${mesAtual}%`)
    .order("data", { ascending: false })
    .limit(10);

  // Calcular totais
  const totalGastos = transactions
    ?.filter((t) => t.valor < 0)
    .reduce((sum, t) => sum + Math.abs(t.valor), 0) || 0;

  const totalReceitas = transactions
    ?.filter((t) => t.valor > 0)
    .reduce((sum, t) => sum + t.valor, 0) || 0;

  const saldo = totalReceitas - totalGastos;

  // Buscar gastos por categoria
  const { data: categoryData } = await supabase
    .from("transactions")
    .select("categoria, valor")
    .eq("user_id", user.id)
    .eq("tipo", "debito")
    .like("data", `${mesAtual}%`);

  const categoryTotals = categoryData?.reduce((acc, t) => {
    const cat = t.categoria || "Outros";
    acc[cat] = (acc[cat] || 0) + Math.abs(t.valor);
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(categoryTotals || {})
    .map(([categoria, total]) => ({ categoria, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

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
        scoreSaude={userData?.score_saude || 0}
        totalTransacoes={transactions?.length || 0}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CategoryChart data={chartData} />
        <RecentTransactions transactions={transactions || []} />
      </div>
    </DashboardLayout>
  );
}