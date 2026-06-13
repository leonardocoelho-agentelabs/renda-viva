import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "../../plugins/supabase.js";
import { env } from "../../env.js";

const anthropic = new Anthropic({ apiKey: env.CLAUDE_API_KEY });

const BUCKET = "relatorios";

// Gera o texto narrativo do relatório mensal via Claude.
// mesAno no formato 'YYYY-MM' (padrão: mês anterior).
export async function gerarRelatorioMensal(
  userId: string,
  mesAno?: string
): Promise<string> {
  const hoje = new Date();
  const mesRef =
    mesAno ||
    new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1).toISOString().slice(0, 7);
  const [ano, mes] = mesRef.split("-").map(Number);

  const inicioMes = `${mesRef}-01`;
  const fimMes = new Date(ano, mes, 0).toISOString().split("T")[0];

  // Mês anterior para comparativo
  const mesAnterior = new Date(ano, mes - 2, 1).toISOString().slice(0, 7);
  const inicioMesAnt = `${mesAnterior}-01`;
  const fimMesAnt = new Date(ano, mes - 1, 0).toISOString().split("T")[0];

  // 1. Perfil
  const { data: perfil } = await supabaseAdmin
    .from("users")
    .select("full_name, renda_mensal, score_saude")
    .eq("id", userId)
    .single();

  // 2. Transações do mês
  const { data: transacoesMes } = await supabaseAdmin
    .from("transactions")
    .select("data, valor, descricao_raw, categoria, tipo")
    .eq("user_id", userId)
    .gte("data", inicioMes)
    .lte("data", fimMes);

  // 3. Transações do mês anterior
  const { data: transacoesAnt } = await supabaseAdmin
    .from("transactions")
    .select("valor, categoria")
    .eq("user_id", userId)
    .gte("data", inicioMesAnt)
    .lte("data", fimMesAnt);

  // 4. Resumo
  const receitas = (transacoesMes || []).filter((t) => Number(t.valor) > 0);
  const despesas = (transacoesMes || []).filter((t) => Number(t.valor) < 0);
  const totalReceitas = receitas.reduce((s, t) => s + Number(t.valor), 0);
  const totalDespesas = despesas.reduce((s, t) => s + Math.abs(Number(t.valor)), 0);
  const saldo = totalReceitas - totalDespesas;

  // 5. Top categorias
  const porCategoria: Record<string, number> = {};
  despesas.forEach((t) => {
    const cat = t.categoria || "Outros";
    porCategoria[cat] = (porCategoria[cat] || 0) + Math.abs(Number(t.valor));
  });
  const topCategorias = Object.entries(porCategoria)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat, val]) => `${cat}: R$ ${val.toFixed(2)}`);

  // 6. Comparativo
  const totalDespesasAnt = (transacoesAnt || [])
    .filter((t) => Number(t.valor) < 0)
    .reduce((s, t) => s + Math.abs(Number(t.valor)), 0);
  const variacaoGastos =
    totalDespesasAnt > 0
      ? (((totalDespesas - totalDespesasAnt) / totalDespesasAnt) * 100).toFixed(1)
      : "0";

  // 7. Anomalias (acima de 3x a média)
  const mediaGasto = totalDespesas / (despesas.length || 1);
  const anomalias = despesas
    .filter((t) => Math.abs(Number(t.valor)) > mediaGasto * 3)
    .slice(0, 3)
    .map((t) => `${t.descricao_raw}: R$ ${Math.abs(Number(t.valor)).toFixed(2)}`);

  const nomeMes = new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  const prompt = `Você é o assistente financeiro pessoal Viva do Renda Viva.
Escreva um relatório financeiro mensal em primeira pessoa para ${perfil?.full_name || "o usuário"}.
Tom: pessoal, direto, construtivo e encorajador. Sem julgamentos. Em português brasileiro.

DADOS DO MÊS DE ${nomeMes.toUpperCase()}:
- Total de receitas: R$ ${totalReceitas.toFixed(2)}
- Total de despesas: R$ ${totalDespesas.toFixed(2)}
- Saldo do mês: R$ ${saldo.toFixed(2)}
- Score de saúde financeira: ${perfil?.score_saude || 0}/100
- Variação de gastos vs mês anterior: ${variacaoGastos}%
- Total de transações: ${transacoesMes?.length || 0}

TOP CATEGORIAS DE GASTO:
${topCategorias.length > 0 ? topCategorias.join("\n") : "Sem despesas registradas"}

TRANSAÇÕES QUE CHAMARAM ATENÇÃO (valores acima da média):
${anomalias.length > 0 ? anomalias.join("\n") : "Nenhuma anomalia detectada"}

ESCREVA O RELATÓRIO com exatamente 6 parágrafos curtos (3-4 linhas cada):

**Resumo executivo**
[Uma frase que resume como foi o mês financeiramente]

**O dinheiro que entrou**
[Sobre as receitas do mês]

**O dinheiro que saiu**
[Sobre as principais despesas e categorias]

**O que chamou atenção**
[Anomalias, padrões interessantes, gastos inesperados]

**Como você evoluiu**
[Comparativo com mês anterior e score de saúde]

**Os próximos 30 dias**
[Uma previsão ou recomendação prática para o próximo mês]

Use linguagem simples e pessoal. Mencione valores reais. Seja específico.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const first = response.content[0];
  return first && first.type === "text" ? first.text : "";
}

// Gera e persiste o relatório no Storage. Retorna o texto e o mês de referência.
export async function gerarESalvarRelatorio(
  userId: string,
  mesAno?: string
): Promise<{ relatorio: string; mes_ano: string }> {
  const hoje = new Date();
  const mesRef =
    mesAno ||
    new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1).toISOString().slice(0, 7);

  const relatorio = await gerarRelatorioMensal(userId, mesRef);

  const path = `${userId}/${mesRef}.md`;
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, relatorio, {
      contentType: "text/markdown; charset=utf-8",
      upsert: true,
    });

  if (error) {
    throw new Error(`Erro ao salvar relatório no Storage: ${error.message}`);
  }

  return { relatorio, mes_ano: mesRef };
}

export { BUCKET as RELATORIOS_BUCKET };
