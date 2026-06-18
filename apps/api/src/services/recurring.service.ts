import type { SupabaseClient } from "@supabase/supabase-js";

export interface RecurringCommitment {
  id: string;
  user_id: string;
  nome: string;
  descricao: string | null;
  categoria: string;
  tipo: "assinatura" | "parcela";
  valor: number;
  dia_vencimento: number;
  total_parcelas: number | null;
  parcelas_pagas: number;
  parcelas_restantes: number | null;
  data_inicio: string;
  data_fim: string | null;
  status: "ativo" | "cancelado" | "concluido";
  cancelado_em: string | null;
  alerta_dias_antes: number;
  alerta_whatsapp: boolean;
  created_at: string;
  updated_at: string;
  // Campos calculados
  proxima_cobranca?: string;
  valor_total_restante?: number;
  dias_para_vencimento?: number;
}

interface CreateCommitmentBody {
  nome: string;
  descricao?: string;
  categoria: string;
  tipo: "assinatura" | "parcela";
  valor: number;
  dia_vencimento: number;
  total_parcelas?: number;
  parcelas_pagas?: number;
  data_inicio?: string;
  alerta_whatsapp?: boolean;
}

interface UpdateCommitmentBody {
  nome?: string;
  descricao?: string;
  categoria?: string;
  valor?: number;
  dia_vencimento?: number;
  alerta_whatsapp?: boolean;
}

interface RecurringSummary {
  total_comprometido_mes: number;
  total_assinaturas: number;
  total_parcelas: number;
  valor_assinaturas: number;
  valor_parcelas: number;
  proximos_7_dias: RecurringCommitment[];
  proximos_30_dias: RecurringCommitment[];
  percentual_renda: number | null;
}

// Calcular próxima data de vencimento
export function calcularProximoVencimento(diaVencimento: number): Date {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();

  // Tenta este mês
  let proxima = new Date(ano, mes, diaVencimento);

  // Se já passou, vai para o próximo mês
  if (proxima <= hoje) {
    proxima = new Date(ano, mes + 1, diaVencimento);
  }

  return proxima;
}

// Calcular dias para vencimento
export function calcularDiasParaVencimento(diaVencimento: number): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const proxima = calcularProximoVencimento(diaVencimento);
  proxima.setHours(0, 0, 0, 0);

  const diffTime = proxima.getTime() - hoje.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Formatar para WhatsApp
export function formatarMensagemAlerta(commitment: RecurringCommitment): string {
  const tipo = commitment.tipo === "assinatura" ? "assinatura" : "parcela";
  const parcela =
    commitment.tipo === "parcela"
      ? ` (${commitment.parcelas_pagas + 1}/${commitment.total_parcelas})`
      : "";
  const dias = calcularDiasParaVencimento(commitment.dia_vencimento);

  return (
    `🔔 *Lembrete Renda Viva*\n\n` +
    `Sua ${tipo} *${commitment.nome}*${parcela} vence em *${dias} dias* ` +
    `(dia ${commitment.dia_vencimento}).\n\n` +
    `💰 Valor: *R$ ${commitment.valor.toFixed(2).replace(".", ",")}*\n\n` +
    `Acesse o Renda Viva para mais detalhes: rendavivaapp.com`
  );
}

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

// Buscar compromissos do usuário
export async function getRecurringCommitments(
  supabase: SupabaseClient,
  userId: string,
  status: string = "ativo"
): Promise<RecurringCommitment[]> {
  let query = supabase
    .from("recurring_commitments")
    .select("*")
    .eq("user_id", userId);

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query.order("dia_vencimento", { ascending: true });

  if (error) {
    console.error("[Recurring] Erro ao buscar compromissos:", error);
    throw error;
  }

  return (data || []).map(addCalculatedFields);
}

// Buscar resumo para dashboard
export async function getRecurringSummary(
  supabase: SupabaseClient,
  userId: string
): Promise<RecurringSummary> {
  // Buscar compromissos ativos
  const { data: commitments, error } = await supabase
    .from("recurring_commitments")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "ativo");

  if (error) {
    console.error("[Recurring] Erro ao buscar resumo:", error);
    throw error;
  }

  // Buscar renda do usuário
  const { data: userData } = await supabase
    .from("users")
    .select("renda_mensal")
    .eq("id", userId)
    .single();

  const hoje = new Date();

  // Calcular totais
  let totalComprometido = 0;
  let totalAssinaturas = 0;
  let valorAssinaturas = 0;
  let totalParcelas = 0;
  let valorParcelas = 0;

  const proximos7Dias: RecurringCommitment[] = [];
  const proximos30Dias: RecurringCommitment[] = [];

  for (const c of commitments || []) {
    const withCalc = addCalculatedFields(c as RecurringCommitment);

    if (c.tipo === "assinatura") {
      totalAssinaturas++;
      valorAssinaturas += Number(c.valor);
      totalComprometido += Number(c.valor);
    } else {
      totalParcelas++;
      valorParcelas += Number(c.valor);
      totalComprometido += Number(c.valor);
    }

    // Verificar vencimentos próximos
    const dias = withCalc.dias_para_vencimento || 0;
    if (dias <= 7) {
      proximos7Dias.push(withCalc);
    }
    if (dias <= 30) {
      proximos30Dias.push(withCalc);
    }
  }

  // Ordenar por dias para vencimento
  proximos7Dias.sort((a, b) => (a.dias_para_vencimento || 0) - (b.dias_para_vencimento || 0));
  proximos30Dias.sort((a, b) => (a.dias_para_vencimento || 0) - (b.dias_para_vencimento || 0));

  // Calcular percentual da renda
  const percentualRenda =
    userData?.renda_mensal && userData.renda_mensal > 0
      ? (totalComprometido / userData.renda_mensal) * 100
      : null;

  return {
    total_comprometido_mes: totalComprometido,
    total_assinaturas: totalAssinaturas,
    total_parcelas: totalParcelas,
    valor_assinaturas: valorAssinaturas,
    valor_parcelas: valorParcelas,
    proximos_7_dias: proximos7Dias,
    proximos_30_dias: proximos30Dias,
    percentual_renda: percentualRenda,
  };
}

// Criar novo compromisso
export async function createRecurringCommitment(
  supabase: SupabaseClient,
  userId: string,
  body: CreateCommitmentBody
): Promise<RecurringCommitment> {
  const insertData: Record<string, unknown> = {
    user_id: userId,
    nome: body.nome.trim(),
    descricao: body.descricao?.trim() || null,
    categoria: body.categoria,
    tipo: body.tipo,
    valor: body.valor,
    dia_vencimento: body.dia_vencimento,
    data_inicio: body.data_inicio || new Date().toISOString().split("T")[0],
    alerta_whatsapp: body.alerta_whatsapp !== false,
    status: "ativo",
  };

  if (body.tipo === "parcela") {
    insertData.total_parcelas = body.total_parcelas;
    insertData.parcelas_pagas = body.parcelas_pagas || 0;
  }

  const { data, error } = await supabase
    .from("recurring_commitments")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error("[Recurring] Erro ao criar compromisso:", error);
    throw error;
  }

  return addCalculatedFields(data as RecurringCommitment);
}

// Atualizar compromisso
export async function updateRecurringCommitment(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  body: UpdateCommitmentBody
): Promise<RecurringCommitment | null> {
  // Buscar compromisso atual
  const { data: existing } = await supabase
    .from("recurring_commitments")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (!existing) {
    return null;
  }

  // Parcelas: apenas alerta_whatsapp pode ser alterado
  if (existing.tipo === "parcela") {
    const allowedFields = ["descricao", "alerta_whatsapp"];
    const updateData: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if ((body as Record<string, unknown>)[key] !== undefined) {
        updateData[key] = (body as Record<string, unknown>)[key];
      }
    }
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("recurring_commitments")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      console.error("[Recurring] Erro ao atualizar compromisso:", error);
      throw error;
    }

    return addCalculatedFields(data as RecurringCommitment);
  }

  // Assinaturas: todos os campos permitidos
  const updateData: Record<string, unknown> = {};
  if (body.nome !== undefined) updateData.nome = body.nome.trim();
  if (body.descricao !== undefined) updateData.descricao = body.descricao?.trim() || null;
  if (body.categoria !== undefined) updateData.categoria = body.categoria;
  if (body.valor !== undefined) updateData.valor = body.valor;
  if (body.dia_vencimento !== undefined) updateData.dia_vencimento = body.dia_vencimento;
  if (body.alerta_whatsapp !== undefined) updateData.alerta_whatsapp = body.alerta_whatsapp;
  updateData.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("recurring_commitments")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    console.error("[Recurring] Erro ao atualizar compromisso:", error);
    throw error;
  }

  return addCalculatedFields(data as RecurringCommitment);
}

// Cancelar compromisso
export async function cancelRecurringCommitment(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<RecurringCommitment | null> {
  const { data, error } = await supabase
    .from("recurring_commitments")
    .update({
      status: "cancelado",
      cancelado_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    console.error("[Recurring] Erro ao cancelar compromisso:", error);
    throw error;
  }

  if (!data) {
    return null;
  }

  return addCalculatedFields(data as RecurringCommitment);
}

// Registrar pagamento de parcela
export async function payRecurringCommitment(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<RecurringCommitment | null> {
  // Buscar compromisso atual
  const { data: existing } = await supabase
    .from("recurring_commitments")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (!existing || existing.tipo !== "parcela") {
    return null;
  }

  const novasPagas = (existing.parcelas_pagas || 0) + 1;
  const novoStatus = novasPagas >= (existing.total_parcelas || 0) ? "concluido" : "ativo";

  const { data, error } = await supabase
    .from("recurring_commitments")
    .update({
      parcelas_pagas: novasPagas,
      status: novoStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    console.error("[Recurring] Erro ao registrar pagamento:", error);
    throw error;
  }

  if (!data) {
    return null;
  }

  return addCalculatedFields(data as RecurringCommitment);
}

// Executar alertas de compromissos (para job diário)
export async function runRecurringAlerts(
  fastify: { supabaseAdmin: SupabaseClient }
): Promise<{ alertas_enviados: number; compromissos_verificados: number }> {
  // Buscar todos os compromissos ativos com alertas habilitados
  const { data: commitments, error } = await fastify.supabaseAdmin
    .from("recurring_commitments")
    .select("*")
    .eq("status", "ativo")
    .eq("alerta_whatsapp", true);

  if (error) {
    console.error("[RECURRING ALERTS] Erro ao buscar compromissos:", error);
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
      const { data: contacts } = await fastify.supabaseAdmin
        .from("whatsapp_contacts")
        .select("telefone")
        .eq("user_id", c.user_id);

      if (contacts && contacts.length > 0) {
        const mensagem = formatarMensagemAlerta(withCalc);

        // Aqui você integraria com o serviço de WhatsApp
        // Por enquanto, apenas logamos
        for (const contact of contacts) {
          console.log(`[RECURRING ALERT] Alerta enviado: ${c.nome} → ${contact.telefone}`);
          console.log(`[RECURRING ALERT] Mensagem: ${mensagem}`);
          alertasEnviados++;
        }
      }
    }
  }

  console.log(`[RECURRING ALERTS] ${alertasEnviados} alertas enviados de ${compromissosVerificados} compromissos verificados`);

  return { alertas_enviados: alertasEnviados, compromissos_verificados: compromissosVerificados };
}
