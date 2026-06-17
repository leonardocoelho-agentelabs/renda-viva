import { supabaseAdmin } from "../plugins/supabase.js";
import { enviarMensagemWhatsApp } from "./whatsapp.service.js";

// Busca TODOS os números de WhatsApp vinculados ao usuário na tabela whatsapp_contacts
async function getNumeroWhatsAppUsuario(userId: string): Promise<string[]> {
  const { data: contatos } = await supabaseAdmin
    .from('whatsapp_contacts')
    .select('telefone')
    .eq('user_id', userId)

  if (!contatos || contatos.length === 0) return []

  // Adicionar prefixo 55 para envio via Evolution API
  return contatos.map(c => `55${c.telefone}`)
}

async function enviarParaTodosOsNumeros(userId: string, mensagem: string): Promise<void> {
  const numeros = await getNumeroWhatsAppUsuario(userId)

  if (numeros.length === 0) {
    console.log(`[Alertas] Usuário ${userId} não tem números WhatsApp cadastrados`)
    return
  }

  await Promise.all(
    numeros.map(numero =>
      enviarMensagemWhatsApp(numero, mensagem).catch(err =>
        console.error(`[Alertas] Erro ao enviar para ${numero}:`, err)
      )
    )
  )
}

function intervaloMesAtual() {
  const hoje = new Date();
  const mesAtual = hoje.toISOString().slice(0, 7);
  const inicioMes = `${mesAtual}-01`;
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];
  return { mesAtual, inicioMes, fimMes };
}

// ALERTA 1 — Orçamento estourado
export async function verificarAlertasOrcamento(userId: string): Promise<void> {
  const { mesAtual, inicioMes, fimMes } = intervaloMesAtual();

  const { data: budgets } = await supabaseAdmin
    .from("budgets")
    .select("categoria, limite, gasto_atual")
    .eq("user_id", userId)
    .eq("mes_ano", mesAtual)
    .eq("status", "aprovado");

  if (!budgets || budgets.length === 0) return;

  const { data: transacoes } = await supabaseAdmin
    .from("transactions")
    .select("categoria, valor")
    .eq("user_id", userId)
    .lt("valor", 0)
    .gte("data", inicioMes)
    .lte("data", fimMes);

  const gastosPorCategoria: Record<string, number> = {};
  (transacoes || []).forEach((t) => {
    const cat = t.categoria || "Outros";
    gastosPorCategoria[cat] =
      (gastosPorCategoria[cat] || 0) + Math.abs(Number(t.valor));
  });

  const alertas: string[] = [];

  for (const budget of budgets) {
    const limite = Number(budget.limite);
    const gasto = gastosPorCategoria[budget.categoria] || 0;
    const percentual = limite > 0 ? (gasto / limite) * 100 : 0;

    if (percentual >= 90 && percentual < 100) {
      alertas.push(
        `⚠️ *${budget.categoria}*: ${percentual.toFixed(0)}% do limite usado (R$ ${gasto.toFixed(2)} de R$ ${limite.toFixed(2)})`
      );
    } else if (percentual >= 100) {
      alertas.push(
        `🚨 *${budget.categoria}*: LIMITE ESTOURADO! Você gastou R$ ${gasto.toFixed(2)} (limite: R$ ${limite.toFixed(2)})`
      );
    }
  }

  if (alertas.length > 0) {
    const mensagem = `🏦 *Renda Viva — Alerta de Orçamento*\n\n${alertas.join(
      "\n"
    )}\n\n_Acesse rendavivaapp.com para detalhes_`;
    await enviarParaTodosOsNumeros(userId, mensagem);
  }
}

// ALERTA 2 — Gasto incomum
export async function verificarGastoIncomum(
  userId: string,
  transacao: { descricao_raw: string; valor: number; categoria: string }
): Promise<void> {
  const tresM = new Date();
  tresM.setMonth(tresM.getMonth() - 3);

  const { data: historico } = await supabaseAdmin
    .from("transactions")
    .select("valor")
    .eq("user_id", userId)
    .eq("categoria", transacao.categoria)
    .lt("valor", 0)
    .gte("data", tresM.toISOString().split("T")[0]);

  if (!historico || historico.length < 3) return;

  const media =
    historico.reduce((s, t) => s + Math.abs(Number(t.valor)), 0) /
    historico.length;
  const valorAbs = Math.abs(Number(transacao.valor));

  if (media > 0 && valorAbs > media * 3) {
    const mensagem =
      `💸 *Renda Viva — Gasto Incomum Detectado*\n\n` +
      `Uma transação chamou atenção:\n` +
      `📌 *${transacao.descricao_raw}*\n` +
      `💰 Valor: R$ ${valorAbs.toFixed(2)}\n` +
      `📊 Média histórica em ${transacao.categoria}: R$ ${media.toFixed(2)}\n\n` +
      `Isso é ${(valorAbs / media).toFixed(1)}x acima da sua média.\n\n` +
      `_Acesse rendavivaapp.com para categorizar_`;
    await enviarParaTodosOsNumeros(userId, mensagem);
  }
}

// ALERTA 3 — Saldo negativo
export async function verificarSaldoNegativo(userId: string): Promise<void> {
  const { inicioMes } = intervaloMesAtual();
  const hoje = new Date().toISOString().split("T")[0];

  const { data: transacoes } = await supabaseAdmin
    .from("transactions")
    .select("valor")
    .eq("user_id", userId)
    .gte("data", inicioMes)
    .lte("data", hoje);

  const saldo = (transacoes || []).reduce((s, t) => s + Number(t.valor), 0);

  if (saldo < 0) {
    const mensagem =
      `🔴 *Renda Viva — Saldo Negativo*\n\n` +
      `Seu saldo do mês está negativo: *R$ ${saldo.toFixed(2)}*\n\n` +
      `Suas despesas superaram suas receitas este mês.\n\n` +
      `💡 Acesse rendavivaapp.com para ver onde é possível reduzir gastos.`;
    await enviarParaTodosOsNumeros(userId, mensagem);
  }
}

// ALERTA 4 — Resumo semanal
export async function enviarResumoSemanal(userId: string): Promise<void> {
  const hoje = new Date();
  const seteDias = new Date(hoje);
  seteDias.setDate(seteDias.getDate() - 7);

  const { data: transacoes } = await supabaseAdmin
    .from("transactions")
    .select("valor, categoria, descricao_raw")
    .eq("user_id", userId)
    .gte("data", seteDias.toISOString().split("T")[0])
    .lte("data", hoje.toISOString().split("T")[0]);

  if (!transacoes || transacoes.length === 0) return;

  const receitas = transacoes
    .filter((t) => Number(t.valor) > 0)
    .reduce((s, t) => s + Number(t.valor), 0);
  const despesas = transacoes
    .filter((t) => Number(t.valor) < 0)
    .reduce((s, t) => s + Math.abs(Number(t.valor)), 0);
  const saldo = receitas - despesas;

  const porCategoria: Record<string, number> = {};
  transacoes
    .filter((t) => Number(t.valor) < 0)
    .forEach((t) => {
      const cat = t.categoria || "Outros";
      porCategoria[cat] = (porCategoria[cat] || 0) + Math.abs(Number(t.valor));
    });
  const topCategoria = Object.entries(porCategoria).sort((a, b) => b[1] - a[1])[0];

  const emoji = saldo >= 0 ? "✅" : "⚠️";

  const mensagem =
    `📊 *Renda Viva — Resumo da Semana*\n\n` +
    `${emoji} *Saldo:* R$ ${saldo.toFixed(2)}\n` +
    `📈 *Receitas:* R$ ${receitas.toFixed(2)}\n` +
    `📉 *Despesas:* R$ ${despesas.toFixed(2)}\n` +
    `🏷️ *Maior gasto:* ${
      topCategoria ? `${topCategoria[0]} (R$ ${topCategoria[1].toFixed(2)})` : "N/A"
    }\n` +
    `📝 *Transações:* ${transacoes.length}\n\n` +
    `_Acesse rendavivaapp.com para detalhes completos_`;

  await enviarParaTodosOsNumeros(userId, mensagem);
}
