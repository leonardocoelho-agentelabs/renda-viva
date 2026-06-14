import { supabaseAdmin } from "../plugins/supabase.js";
import { getClaudeService, type ParsedTransaction } from "./claude.service.js";
import { buscarTransacoes, type PluggyTransaction } from "./pluggy.service.js";

// Normaliza uma transação da Pluggy para o formato do Renda Viva.
export function normalizarTransacaoPluggy(
  tx: PluggyTransaction,
  userId: string
) {
  return {
    user_id: userId,
    data: tx.date.split("T")[0],
    valor: tx.type === "DEBIT" ? -Math.abs(tx.amount) : Math.abs(tx.amount),
    descricao_raw: tx.description,
    categoria: null as string | null,
    tipo: tx.type === "DEBIT" ? "debito" : "credito",
    status_revisao: "pendente",
    origem: "open_finance",
    pluggy_transaction_id: tx.id,
  };
}

// Categoriza em lotes de 20 reutilizando o ClaudeService existente.
async function categorizar(
  userId: string,
  inseridas: Array<{
    id: string;
    data: string;
    valor: number;
    descricao_raw: string;
    tipo: string;
  }>
): Promise<void> {
  if (inseridas.length === 0) return;

  const claude = getClaudeService();

  const { data: correcoes } = await supabaseAdmin
    .from("user_corrections")
    .select("descricao_raw, categoria_correta, subcategoria_correta")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  const correcoesFormatadas = (correcoes || []).map((c) => ({
    descricao_raw: c.descricao_raw,
    categoria_correta: c.categoria_correta,
    subcategoria_correta: c.subcategoria_correta,
  }));

  const batchSize = 20;
  for (let i = 0; i < inseridas.length; i += batchSize) {
    const batch = inseridas.slice(i, i + batchSize);
    const parsed: ParsedTransaction[] = batch.map((t) => ({
      data: t.data,
      valor: Number(t.valor),
      descricao_raw: t.descricao_raw,
      tipo: t.tipo === "credito" ? "credito" : "debito",
    }));

    let categorized: Awaited<ReturnType<typeof claude.categorizarTransacoes>> = [];
    try {
      categorized = await claude.categorizarTransacoes(parsed, correcoesFormatadas);
    } catch (e) {
      console.error("[OpenFinance] Erro ao categorizar batch:", e);
    }

    for (let j = 0; j < categorized.length; j++) {
      const cat = categorized[j];
      const id = batch[j]?.id;
      if (!id) continue;

      const status =
        cat.score >= 0.9 ? "aprovado" : cat.score >= 0.7 ? "revisar" : "pendente";

      await supabaseAdmin
        .from("transactions")
        .update({
          categoria: cat.categoria,
          subcategoria: cat.subcategoria,
          score_confianca: cat.score,
          is_recorrente: cat.is_recorrente,
          status_revisao: status,
        })
        .eq("id", id);
    }
  }
}

// Sincroniza um item: busca transações dos últimos `dias` dias, insere as novas
// (dedupe por pluggy_transaction_id) e as categoriza. Retorna quantas foram importadas.
export async function sincronizarItem(
  userId: string,
  itemId: string,
  dias = 30
): Promise<number> {
  const fim = new Date();
  const inicio = new Date();
  inicio.setDate(inicio.getDate() - dias);
  const dataInicio = inicio.toISOString().split("T")[0];
  const dataFim = fim.toISOString().split("T")[0];

  const transacoes = await buscarTransacoes(itemId, dataInicio, dataFim);

  let importadas = 0;

  if (transacoes.length > 0) {
    const normalizadas = transacoes.map((t) => normalizarTransacaoPluggy(t, userId));

    // Dedupe em nível de aplicação: remove ids que já existem no banco.
    const ids = normalizadas.map((n) => n.pluggy_transaction_id);
    const { data: existentes } = await supabaseAdmin
      .from("transactions")
      .select("pluggy_transaction_id")
      .in("pluggy_transaction_id", ids);

    const jaExistem = new Set(
      (existentes || []).map((e) => e.pluggy_transaction_id as string)
    );
    const novas = normalizadas.filter(
      (n) => !jaExistem.has(n.pluggy_transaction_id)
    );

    if (novas.length > 0) {
      const { data: inseridas, error } = await supabaseAdmin
        .from("transactions")
        .insert(novas)
        .select("id, data, valor, descricao_raw, tipo");

      if (error) {
        throw new Error(`Erro ao inserir transações Pluggy: ${error.message}`);
      }

      importadas = inseridas?.length || 0;
      await categorizar(
        userId,
        (inseridas || []).map((t) => ({
          id: t.id,
          data: t.data,
          valor: Number(t.valor),
          descricao_raw: t.descricao_raw,
          tipo: t.tipo,
        }))
      );
    }
  }

  // Atualiza o status/last_sync_at da conexão
  await supabaseAdmin
    .from("bank_connections")
    .update({ last_sync_at: new Date().toISOString(), status: "active" })
    .eq("user_id", userId)
    .eq("pluggy_item_id", itemId);

  return importadas;
}
