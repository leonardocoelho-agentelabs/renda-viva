import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

interface MembroConvite {
  nome: string;
  email: string;
  whatsapp: string;
}

const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

export class FamilyService {
  constructor(private supabase: SupabaseClient) {}

  // Buscar família do usuário (como titular ou membro)
  async getFamilyByUser(userId: string) {
    // Verifica se é titular
    const { data: asOwner } = await this.supabase
      .from("families")
      .select(`
        *,
        family_members (
          id, nome_membro, email_convidado, whatsapp_membro,
          status, user_id, convidado_em, aceito_em
        )
      `)
      .eq("owner_id", userId)
      .maybeSingle();

    if (asOwner) return { family: asOwner, role: "owner" as const };

    // Verifica se é membro
    const { data: asMember } = await this.supabase
      .from("family_members")
      .select(`
        *,
        families (
          *,
          family_members (
            id, nome_membro, email_convidado, whatsapp_membro,
            status, user_id, convidado_em, aceito_em
          )
        )
      `)
      .eq("user_id", userId)
      .eq("status", "ativo")
      .maybeSingle();

    if (asMember?.families) {
      return { family: asMember.families, role: "member" as const, memberData: asMember };
    }

    return null;
  }

  // Criar família e convidar membro
  async createFamilyAndInvite(
    ownerId: string,
    ownerName: string,
    membro: MembroConvite
  ) {
    // Verificar se já tem família
    const { data: existing } = await this.supabase
      .from("families")
      .select("id")
      .eq("owner_id", ownerId)
      .maybeSingle();

    if (existing) {
      throw new Error("Você já possui uma família criada");
    }

    // Criar família
    const { data: family, error: familyError } = await this.supabase
      .from("families")
      .insert({ owner_id: ownerId, nome: `Família ${ownerName}` })
      .select()
      .single();

    if (familyError) throw familyError;

    // Gerar token de convite
    const token = randomUUID();
    const expira = new Date(Date.now() + SETE_DIAS_MS);

    // Inserir membro pendente
    const { data: member, error: memberError } = await this.supabase
      .from("family_members")
      .insert({
        family_id: family.id,
        email_convidado: membro.email.toLowerCase().trim(),
        nome_membro: membro.nome,
        whatsapp_membro: membro.whatsapp,
        token_convite: token,
        token_expira_em: expira.toISOString(),
        status: "pendente",
      })
      .select()
      .single();

    if (memberError) throw memberError;

    return { family, member, token };
  }

  // Convidar membro para família existente
  async inviteMember(ownerId: string, membro: MembroConvite) {
    // Buscar família do titular
    const { data: family, error: familyError } = await this.supabase
      .from("families")
      .select("id, family_members(id, status)")
      .eq("owner_id", ownerId)
      .maybeSingle();

    if (familyError || !family) throw new Error("Família não encontrada");

    // Verificar limite (1 membro ativo ou pendente)
    const activeMembers = (family.family_members ?? []).filter(
      (m: any) => m.status === "ativo" || m.status === "pendente"
    );
    if (activeMembers.length >= 1) {
      throw new Error("Limite de 1 membro por família atingido");
    }

    const token = randomUUID();
    const expira = new Date(Date.now() + SETE_DIAS_MS);

    const { data: member, error } = await this.supabase
      .from("family_members")
      .insert({
        family_id: family.id,
        email_convidado: membro.email.toLowerCase().trim(),
        nome_membro: membro.nome,
        whatsapp_membro: membro.whatsapp,
        token_convite: token,
        token_expira_em: expira.toISOString(),
        status: "pendente",
      })
      .select()
      .single();

    if (error) throw error;

    return { member, token };
  }

  // Validar token de convite (página pública)
  async validateInviteToken(token: string) {
    const { data, error } = await this.supabase
      .from("family_members")
      .select("*, families(nome, owner_id)")
      .eq("token_convite", token)
      .eq("status", "pendente")
      .maybeSingle();

    if (error || !data) return null;

    // Verificar expiração
    if (data.token_expira_em && new Date(data.token_expira_em) < new Date()) {
      return null;
    }

    return data;
  }

  // Aceitar convite (após criar conta)
  async acceptInvite(token: string, userId: string) {
    const invite = await this.validateInviteToken(token);
    if (!invite) throw new Error("Convite inválido ou expirado");

    // Vincular user_id ao membro
    const { error } = await this.supabase
      .from("family_members")
      .update({
        user_id: userId,
        status: "ativo",
        aceito_em: new Date().toISOString(),
        token_convite: null,
      })
      .eq("token_convite", token);

    if (error) throw error;

    // Atualizar family_id no perfil do usuário
    await this.supabase
      .from("users")
      .update({ family_id: invite.family_id })
      .eq("id", userId);

    return invite;
  }

  // Remover membro
  async removeMember(ownerId: string, memberId: string) {
    const { data: family } = await this.supabase
      .from("families")
      .select("id")
      .eq("owner_id", ownerId)
      .maybeSingle();

    if (!family) throw new Error("Família não encontrada");

    const { data: member } = await this.supabase
      .from("family_members")
      .select("user_id")
      .eq("id", memberId)
      .eq("family_id", family.id)
      .maybeSingle();

    if (!member) throw new Error("Membro não encontrado");

    // Remover family_id do usuário membro
    if (member.user_id) {
      await this.supabase
        .from("users")
        .update({ family_id: null })
        .eq("id", member.user_id);
    }

    await this.supabase
      .from("family_members")
      .update({ status: "removido", user_id: null })
      .eq("id", memberId);
  }

  // Dashboard familiar — transações consolidadas
  async getFamilyDashboard(userId: string) {
    const familyData = await this.getFamilyByUser(userId);
    if (!familyData) throw new Error("Família não encontrada");

    const family = familyData.family;

    // Coletar todos os user_ids da família
    const memberIds: string[] = [];

    // Adicionar titular
    memberIds.push(family.owner_id);

    // Adicionar membros ativos
    const activeMembers =
      family.family_members?.filter((m: any) => m.status === "ativo" && m.user_id) || [];
    activeMembers.forEach((m: any) => memberIds.push(m.user_id));

    // Janela do mês corrente (coluna `data` é DATE)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const toDateStr = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;

    const { data: transactions } = await this.supabase
      .from("transactions")
      .select("user_id, valor, tipo, categoria, data, descricao_raw")
      .in("user_id", memberIds)
      .gte("data", toDateStr(startOfMonth))
      .lte("data", toDateStr(endOfMonth))
      .order("data", { ascending: false });

    // Buscar perfis dos membros
    const { data: profiles } = await this.supabase
      .from("users")
      .select("id, full_name, score_saude")
      .in("id", memberIds);

    // Calcular totais por membro
    // Débitos são armazenados com valor negativo — usamos Math.abs para gastos.
    const membersStats =
      profiles?.map((profile) => {
        const userTx = transactions?.filter((t) => t.user_id === profile.id) || [];
        const receitas = userTx
          .filter((t) => t.tipo === "credito")
          .reduce((s, t) => s + Math.abs(Number(t.valor)), 0);
        const gastos = userTx
          .filter((t) => t.tipo === "debito")
          .reduce((s, t) => s + Math.abs(Number(t.valor)), 0);
        const role = profile.id === family.owner_id ? "owner" : "member";

        return {
          user_id: profile.id,
          nome: profile.full_name,
          score: profile.score_saude,
          receitas,
          gastos,
          saldo: receitas - gastos,
          role,
        };
      }) || [];

    // Totais consolidados
    const totalReceitas = membersStats.reduce((s, m) => s + m.receitas, 0);
    const totalGastos = membersStats.reduce((s, m) => s + m.gastos, 0);
    const scoresMedio =
      membersStats.length > 0
        ? Math.round(
            membersStats.reduce((s, m) => s + (m.score || 0), 0) / membersStats.length
          )
        : 0;

    return {
      family: { id: family.id, nome: family.nome },
      resumo: {
        total_membros: membersStats.length,
        receitas_total: totalReceitas,
        gastos_total: totalGastos,
        saldo_total: totalReceitas - totalGastos,
        score_medio: scoresMedio,
      },
      membros: membersStats,
      transacoes_recentes: transactions?.slice(0, 20) || [],
    };
  }
}
