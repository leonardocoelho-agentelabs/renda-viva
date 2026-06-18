import type { SupabaseClient } from "@supabase/supabase-js";
import {
  RecurringCommitment,
  calcularProximoVencimento,
  calcularDiasParaVencimento,
  formatarMensagemAlerta,
} from "./recurring.service.js";

// Adicionar campos calculados ao compromisso
function addCalculatedFields(commitment: RecurringCommitment): RecurringCommitment {
  const proximaCobranca = calcularProximoVencimento(commitment.dia_vencimento);
  const diasParaVencimento = calcularDiasParaVencimento(commitment.dia_vencimento);

  return {
    ...commitment,
    proxima_cobranca: proximaCobranca.toISOString().split("T")[0],
    dias_para_vencimento: diasParaVencimento,
    valor_total_restante:
      commitment.tipo === "parcela" && commitment.total_parcelas
        ? commitment.valor * (commitment.total_parcelas - commitment.parcelas_pagas)
        : undefined,
  };
}

export async function runRecurringAlertsJob(
  supabase: SupabaseClient
): Promise<{ alertas_enviados: number; compromissos_verificados: number }> {
  console.log("[RECURRING ALERTS JOB] Iniciando verificação de alertas...");

  // Buscar todos os compromissos ativos com alertas habilitados
  const { data: commitments, error } = await supabase
    .from("recurring_commitments")
    .select("*")
    .eq("status", "ativo")
    .eq("alerta_whatsapp", true);

  if (error) {
    console.error("[RECURRING ALERTS JOB] Erro ao buscar compromissos:", error);
    throw error;
  }

  let alertasEnviados = 0;
  const compromissosVerificados = commitments?.length || 0;

  for (const c of commitments || []) {
    const withCalc = addCalculatedFields(c as RecurringCommitment);
    const diasParaVencimento = withCalc.dias_para_vencimento || 0;

    // Enviar alerta se faltam exatamente 3 dias
    if (diasParaVencimento === 3) {
      // Buscar contatos WhatsApp do usuário
      const { data: contacts } = await supabase
        .from("whatsapp_contacts")
        .select("id, user_id, telefone, nome")
        .eq("user_id", c.user_id);

      if (contacts && contacts.length > 0) {
        const mensagem = formatarMensagemAlerta(withCalc);

        // Log para cada contato
        for (const contact of contacts) {
          console.log(`[RECURRING ALERT] Alerta enviado: ${c.nome} → ${contact.telefone}`);
          console.log(`[RECURRING ALERT] Mensagem: ${mensagem}`);

          // Aqui você pode integrar com o serviço de WhatsApp
          // Exemplo de integração futura:
          // await sendWhatsAppMessage(contact.telefone, mensagem);

          alertasEnviados++;
        }
      } else {
        console.log(`[RECURRING ALERT] Sem contatos WhatsApp para: ${c.nome} (user: ${c.user_id})`);
      }
    }
  }

  console.log(
    `[RECURRING ALERTS JOB] ${alertasEnviados} alertas enviados de ${compromissosVerificados} compromissos verificados`
  );

  return { alertas_enviados: alertasEnviados, compromissos_verificados: compromissosVerificados };
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  // Para execução direta via Node
  console.log("[RECURRING ALERTS JOB] Este módulo deve ser executado via API ou scheduler");
  process.exit(0);
}
