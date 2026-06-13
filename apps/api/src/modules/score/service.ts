import { supabaseAdmin } from "../../plugins/supabase.js";

export interface ScoreDimensao {
  nome: string;
  pontos: number;
  max: number;
  descricao: string;
}

export interface ScoreResultado {
  score: number;
  dimensoes: ScoreDimensao[];
}

interface Transacao {
  data: string;
  valor: number;
  categoria: string | null;
  descricao_raw: string;
}

function diasAtras(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().split("T")[0];
}

// Retorna 'YYYY-MM' de N meses atrás (0 = mês atual)
function mesAtrasStr(meses: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - meses);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// 1. Fluxo de caixa (25)
function dimFluxoCaixa(transacoes: Transacao[]): ScoreDimensao {
  const limite = diasAtras(90);
  const recentes = transacoes.filter((t) => t.data >= limite);
  const receitas = recentes
    .filter((t) => Number(t.valor) > 0)
    .reduce((s, t) => s + Number(t.valor), 0);
  const despesas = recentes
    .filter((t) => Number(t.valor) < 0)
    .reduce((s, t) => s + Math.abs(Number(t.valor)), 0);

  let pontos = 0;
  let descricao: string;
  if (despesas === 0) {
    // Sem despesas registradas — não dá para avaliar o fluxo
    pontos = receitas > 0 ? 15 : 0;
    descricao =
      receitas > 0
        ? "Você tem receitas mas poucas despesas registradas. Importe seus extratos para uma análise completa."
        : "Importe seus extratos para avaliarmos seu fluxo de caixa.";
  } else {
    const ratio = receitas / despesas;
    if (ratio >= 1.3) pontos = 25;
    else if (ratio >= 1.1) pontos = 20;
    else if (ratio >= 1.0) pontos = 15;
    else if (ratio >= 0.8) pontos = 8;
    else pontos = 0;

    descricao =
      ratio >= 1.1
        ? "Suas receitas superam confortavelmente as despesas. Continue assim!"
        : ratio >= 1.0
        ? "Você fecha no positivo, mas com pouca folga. Tente reduzir gastos ou aumentar a renda."
        : "Suas despesas estão consumindo a maior parte (ou mais) da sua renda. Priorize cortar gastos.";
  }

  return { nome: "Fluxo de caixa", pontos, max: 25, descricao };
}

// 2. Comportamento de gastos (20)
function dimComportamento(transacoes: Transacao[]): ScoreDimensao {
  const limite = diasAtras(30);
  const recentes = transacoes.filter((t) => t.data >= limite);
  const categorias = new Set(
    recentes.map((t) => t.categoria).filter((c): c is string => !!c)
  );
  const n = categorias.size;

  let pontos = 0;
  if (n >= 3) pontos = 20;
  else if (n === 2) pontos = 12;
  else if (n === 1) pontos = 6;

  const descricao =
    n >= 3
      ? "Seus gastos estão bem categorizados, o que facilita o controle."
      : n === 0
      ? "Sem transações categorizadas nos últimos 30 dias. Importe e categorize seus gastos."
      : "Categorize mais dos seus gastos para entender melhor para onde vai seu dinheiro.";

  return { nome: "Comportamento de gastos", pontos, max: 20, descricao };
}

// 3. Consistência (20)
function dimConsistencia(transacoes: Transacao[]): ScoreDimensao {
  const meses = [mesAtrasStr(0), mesAtrasStr(1), mesAtrasStr(2)];
  const mesesComDados = meses.filter((m) =>
    transacoes.some((t) => t.data.startsWith(m))
  ).length;

  let pontos = 0;
  if (mesesComDados === 3) pontos = 20;
  else if (mesesComDados === 2) pontos = 13;
  else if (mesesComDados === 1) pontos = 6;

  const descricao =
    mesesComDados === 3
      ? "Você mantém seus dados atualizados todos os meses. Excelente disciplina!"
      : "Importe seus extratos regularmente, todo mês, para um acompanhamento consistente.";

  return { nome: "Consistência", pontos, max: 20, descricao };
}

// 4. Tendência (15)
function dimTendencia(transacoes: Transacao[]): ScoreDimensao {
  const mesAtual = mesAtrasStr(0);
  const mesAnterior = mesAtrasStr(1);

  const gastoMes = (mes: string) =>
    transacoes
      .filter((t) => t.data.startsWith(mes) && Number(t.valor) < 0)
      .reduce((s, t) => s + Math.abs(Number(t.valor)), 0);

  const atual = gastoMes(mesAtual);
  const anterior = gastoMes(mesAnterior);

  let pontos: number;
  let descricao: string;

  if (anterior === 0) {
    pontos = atual === 0 ? 10 : 5;
    descricao =
      "Ainda não há histórico suficiente do mês anterior para avaliar a tendência dos seus gastos.";
  } else {
    const variacao = (atual - anterior) / anterior;
    if (variacao < -0.05) {
      pontos = 15;
      descricao = "Você reduziu seus gastos em relação ao mês anterior. Ótimo controle!";
    } else if (variacao <= 0.05) {
      pontos = 10;
      descricao = "Seus gastos estão estáveis em relação ao mês anterior.";
    } else if (variacao <= 0.2) {
      pontos = 5;
      descricao = "Seus gastos subiram um pouco. Fique atento para não perder o controle.";
    } else {
      pontos = 0;
      descricao = "Seus gastos aumentaram bastante em relação ao mês anterior. Reveja seu orçamento.";
    }
  }

  return { nome: "Tendência de gastos", pontos, max: 15, descricao };
}

// 5. Diversificação de receita (10)
function dimDiversificacao(transacoes: Transacao[]): ScoreDimensao {
  const limite = diasAtras(90);
  const fontes = new Set(
    transacoes
      .filter((t) => t.data >= limite && Number(t.valor) > 0)
      .map((t) => (t.descricao_raw || "").trim().toLowerCase())
      .filter((d) => d.length > 0)
  );
  const n = fontes.size;

  let pontos = 0;
  if (n >= 3) pontos = 10;
  else if (n === 2) pontos = 6;
  else if (n === 1) pontos = 3;

  const descricao =
    n >= 3
      ? "Você tem múltiplas fontes de receita, o que reduz seu risco financeiro."
      : n === 0
      ? "Nenhuma receita registrada nos últimos 90 dias."
      : "Depender de poucas fontes de renda é arriscado. Considere diversificar.";

  return { nome: "Diversificação de receita", pontos, max: 10, descricao };
}

// 6. Investimentos (10)
function dimInvestimentos(transacoes: Transacao[]): ScoreDimensao {
  const invest = transacoes.filter(
    (t) => (t.categoria || "").toLowerCase() === "investimentos"
  );
  const mesesComInvest = new Set(invest.map((t) => t.data.slice(0, 7))).size;

  let pontos = 0;
  let descricao: string;
  if (mesesComInvest >= 2) {
    pontos = 10;
    descricao = "Você investe de forma regular. Esse é o caminho para construir patrimônio!";
  } else if (invest.length > 0) {
    pontos = 6;
    descricao = "Você já investe, mas de forma esporádica. Tente criar o hábito mensal.";
  } else {
    pontos = 0;
    descricao =
      "Você ainda não registrou investimentos. Mesmo pequenos aportes mensais fazem diferença.";
  }

  return { nome: "Investimentos", pontos, max: 10, descricao };
}

// Calcula o score e persiste em users.score_saude
export async function calcularScore(userId: string): Promise<ScoreResultado> {
  // Janela de 120 dias cobre as 6 dimensões (90 dias + 3 meses + mês anterior)
  const limite = diasAtras(130);

  const { data: transacoesRaw } = await supabaseAdmin
    .from("transactions")
    .select("data, valor, categoria, descricao_raw")
    .eq("user_id", userId)
    .gte("data", limite);

  const transacoes: Transacao[] = (transacoesRaw || []).map((t) => ({
    data: t.data,
    valor: Number(t.valor),
    categoria: t.categoria,
    descricao_raw: t.descricao_raw,
  }));

  const dimensoes: ScoreDimensao[] = [
    dimFluxoCaixa(transacoes),
    dimComportamento(transacoes),
    dimConsistencia(transacoes),
    dimTendencia(transacoes),
    dimDiversificacao(transacoes),
    dimInvestimentos(transacoes),
  ];

  const score = dimensoes.reduce((s, d) => s + d.pontos, 0);

  await supabaseAdmin
    .from("users")
    .update({ score_saude: score })
    .eq("id", userId);

  return { score, dimensoes };
}
