import { supabaseAdmin } from "../plugins/supabase.js";
import { enviarParaTodosOsNumeros } from "./alerts.service.js";

export interface ModoCriseResultado {
  em_crises: boolean;
  motivo?: string;
  criterios: {
    saldoNegativo3Meses: boolean;
    saldoCaindo: boolean;
    scoreCritico: boolean;
  };
}

/**
 * Verifica se o usuário está em modo crise financeira.
 * Critérios:
 * 1. Saldo negativo por 3 meses consecutivos
 * 2. Saldo caindo por 3 meses + score abaixo de 30
 */
export async function verificarModoCrise(
  userId: string
): Promise<ModoCriseResultado> {
  const resultado: ModoCriseResultado = {
    em_crises: false,
    criterios: {
      saldoNegativo3Meses: false,
      saldoCaindo: false,
      scoreCritico: false,
    },
  };

  // Buscar saldo dos últimos 3 meses
  const tresMesesAtras = new Date();
  tresMesesAtras.setMonth(tresMesesAtras.getMonth() - 3);

  const { data: transacoes } = await supabaseAdmin
    .from("transactions")
    .select("data, valor")
    .eq("user_id", userId)
    .gte("data", tresMesesAtras.toISOString().split("T")[0])
    .order("data", { ascending: true });

  if (!transacoes || transacoes.length < 10) {
    return resultado;
  }

  // Calcular saldo por mês
  const saldosPorMes: Record<string, number> = {};
  for (const t of transacoes) {
    const mes = t.data.substring(0, 7); // YYYY-MM
    saldosPorMes[mes] = (saldosPorMes[mes] || 0) + Number(t.valor);
  }

  const saldos = Object.values(saldosPorMes);

  // CRITÉRIO 1: Saldo negativo por 3 meses consecutivos
  const tresUltimos = saldos.slice(-3);
  resultado.criterios.saldoNegativo3Meses =
    saldos.length >= 3 && tresUltimos.length === 3 && tresUltimos.every((s) => s < 0);

  // CRITÉRIO 2: Saldo caindo por 3 meses
  if (saldos.length >= 3) {
    const ultimo = saldos[saldos.length - 1];
    const penultimo = saldos[saldos.length - 2];
    const antepenultimo = saldos[saldos.length - 3];
    resultado.criterios.saldoCaindo = ultimo < penultimo && penultimo < antepenultimo;
  }

  // CRITÉRIO 3: Score de saúde abaixo de 30
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("score_saude")
    .eq("id", userId)
    .single();

  const scoreSaude = user?.score_saude || 100;
  resultado.criterios.scoreCritico = scoreSaude < 30;

  // Determinar se está em crise
  resultado.em_crises =
    resultado.criterios.saldoNegativo3Meses ||
    (resultado.criterios.saldoCaindo && resultado.criterios.scoreCritico);

  // Gerar motivo descritivo
  if (resultado.criterios.saldoNegativo3Meses) {
    resultado.motivo = "Saldo negativo por 3 meses consecutivos";
  } else if (resultado.criterios.saldoCaindo && resultado.criterios.scoreCritico) {
    resultado.motivo = "Saldo em queda e score de saúde crítico";
  }

  // Atualizar flag no banco
  await supabaseAdmin
    .from("users")
    .update({
      modo_crise: resultado.em_crises,
      modo_crise_ativado_em: resultado.em_crises ? new Date().toISOString() : null,
    })
    .eq("id", userId);

  // Enviar alerta WhatsApp se entrou em crise
  if (resultado.em_crises) {
    console.log(`[MODO CRISE] Ativado para user ${userId}`);

    const mensagemCrise =
      "⚠️ *Alerta Renda Viva*\n\n" +
      "Detectamos sinais de estresse financeiro na sua conta.\n\n" +
      "Acesse o app para ver o painel de crise e um plano de ação personalizado.\n\n" +
      "_Renda Viva — Sua saúde financeira importa_";

    await enviarParaTodosOsNumeros(userId, mensagemCrise);
  }

  return resultado;
}

/**
 * Desativa o modo crise manualmente
 */
export async function desativarModoCrise(userId: string): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("users")
    .update({
      modo_crise: false,
      modo_crise_ativado_em: null,
    })
    .eq("id", userId);

  return !error;
}

/**
 * Busca status do modo crise do usuário
 */
export async function getModoCriseStatus(
  userId: string
): Promise<{ modo_crise: boolean; ativado_em?: string }> {
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("modo_crise, modo_crise_ativado_em")
    .eq("id", userId)
    .single();

  return {
    modo_crise: user?.modo_crise || false,
    ativado_em: user?.modo_crise_ativado_em || undefined,
  };
}
