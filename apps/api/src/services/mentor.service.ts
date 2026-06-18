import type { SupabaseClient } from "@supabase/supabase-js";
import { enviarParaTodosOsNumeros } from "./alerts.service.js";
import { env } from "../env.js";

export interface MentorObjective {
  id: string;
  user_id: string;
  objetivo: string;
  valor_alvo: number | null;
  prazo: string | null;
  ativo: boolean;
  progresso_atual: number;
  ultimo_alerta: string | null;
  ultimo_alerta_em: string | null;
  created_at: string;
}

/**
 * Lista objetivos ativos do mentor para o usuário
 */
export async function listarObjetivosMentor(
  supabase: SupabaseClient,
  userId: string
): Promise<MentorObjective[]> {
  const { data, error } = await supabase
    .from("mentor_objectives")
    .select("*")
    .eq("user_id", userId)
    .eq("ativo", true)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

/**
 * Cria um novo objetivo do mentor
 */
export async function criarObjetivoMentor(
  supabase: SupabaseClient,
  userId: string,
  objetivo: string,
  valorAlvo?: number,
  prazo?: string
): Promise<MentorObjective> {
  const { data, error } = await supabase
    .from("mentor_objectives")
    .insert({
      user_id: userId,
      objetivo,
      valor_alvo: valorAlvo || null,
      prazo: prazo || null,
      ativo: true,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Remove um objetivo do mentor
 */
export async function removerObjetivoMentor(
  supabase: SupabaseClient,
  userId: string,
  objetivoId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("mentor_objectives")
    .delete()
    .eq("id", objetivoId)
    .eq("user_id", userId);

  return !error;
}

/**
 * Atualiza o progresso de um objetivo
 */
export async function atualizarProgressoObjetivo(
  supabase: SupabaseClient,
  userId: string,
  objetivoId: string,
  progresso: number
): Promise<void> {
  await supabase
    .from("mentor_objectives")
    .update({ progresso_atual: progresso })
    .eq("id", objetivoId)
    .eq("user_id", userId);
}

/**
 * Executa alertas do mentor para um usuário
 * Deve ser chamado diariamente (ex: via cron às 18h)
 */
export async function runMentorAlerts(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  // Buscar objetivos ativos
  const objectives = await listarObjetivosMentor(supabase, userId);

  if (!objectives || objectives.length === 0) return;

  // Buscar transações do mês atual
  const hoje = new Date();
  const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  const diasRestantes = diasNoMes - hoje.getDate();

  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    .toISOString()
    .split("T")[0];

  const { data: transacoes } = await supabase
    .from("transactions")
    .select("valor, categoria, descricao_raw, data")
    .eq("user_id", userId)
    .gte("data", inicioMes);

  // Calcular gastos do mês
  const gastosMes =
    transacoes
      ?.filter((t) => Number(t.valor) < 0)
      .reduce((sum, t) => sum + Math.abs(Number(t.valor)), 0) || 0;

  // Para cada objetivo, gerar alerta contextual
  for (const obj of objectives) {
    // Gerar alerta via IA
    const prompt = `
Você é um mentor financeiro. O usuário tem o objetivo: "${obj.objetivo}".
${obj.valor_alvo ? `Valor alvo: R$ ${obj.valor_alvo.toLocaleString("pt-BR")}.` : ""}
Gastos do mês até agora: R$ ${gastosMes.toFixed(2)}.
Dias restantes no mês: ${diasRestantes}.
Data: ${hoje.toLocaleDateString("pt-BR")}.

Gere UMA mensagem curta de mentor (máx 2 frases) para WhatsApp.
Seja direto, encorajador e específico.
Não use markdown. Use apenas texto simples.
Retorne APENAS a mensagem, sem mais nada.
`.trim();

    let mensagem = "";

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": env.CLAUDE_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5",
          max_tokens: 150,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        mensagem = data.content?.[0]?.text?.trim() || "";
      }
    } catch (aiErr) {
      console.error("[Mentor] Erro ao gerar alerta com IA:", aiErr);
      // Fallback: gerar mensagem simples
      mensagem = gastosMes > 0
        ? `Você já gastou R$ ${gastosMes.toFixed(2)} este mês. Faltam ${diasRestantes} dias.`
        : "Continue assim! Sem gastos registrados este mês.";
    }

    // Atualizar último alerta
    await supabase
      .from("mentor_objectives")
      .update({
        ultimo_alerta: mensagem,
        ultimo_alerta_em: new Date().toISOString(),
      })
      .eq("id", obj.id);

    // Enviar via WhatsApp
    const mensagemFormatada = `🎯 *Mentor Renda Viva*\n\n${mensagem}`;
    await enviarParaTodosOsNumeros(userId, mensagemFormatada);
  }
}

/**
 * Verifica e atualiza progresso dos objetivos baseado nas transações
 */
export async function atualizarProgressoObjetivos(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const objectives = await listarObjetivosMentor(supabase, userId);

  if (!objectives || objectives.length === 0) return;

  // Buscar transações dos últimos 6 meses para calcular progresso
  const seisMesesAtras = new Date();
  seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6);

  const { data: transacoes } = await supabase
    .from("transactions")
    .select("valor, categoria")
    .eq("user_id", userId)
    .gte("data", seisMesesAtras.toISOString().split("T")[0]);

  const totalInvestido =
    transacoes
      ?.filter(
        (t) =>
          Number(t.valor) < 0 &&
          (t.categoria?.toLowerCase().includes("investimento") ||
            t.categoria?.toLowerCase().includes("poupança"))
      )
      .reduce((sum, t) => sum + Math.abs(Number(t.valor)), 0) || 0;

  // Atualizar progresso para objetivos que têm valor alvo
  for (const obj of objectives) {
    if (obj.valor_alvo && obj.valor_alvo > 0) {
      const progresso = Math.min(100, (totalInvestido / obj.valor_alvo) * 100);
      await atualizarProgressoObjetivo(supabase, userId, obj.id, progresso);
    }
  }
}
