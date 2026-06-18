import { supabaseAdmin } from "../plugins/supabase.js";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface UserCorrection {
  descricao_raw: string;
  categoria_correta: string;
  subcategoria_correta: string | null;
}

/**
 * Busca histórico de correções do usuário para few-shot learning.
 * Deve ser chamada UMA VEZ por upload, não por transação.
 */
export async function getUserCorrections(
  userId: string,
  limit = 50
): Promise<UserCorrection[]> {
  const { data, error } = await supabaseAdmin
    .from("user_corrections")
    .select("descricao_raw, categoria_correta, subcategoria_correta")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[FEW-SHOT] Erro ao buscar correções:", error);
    return [];
  }

  console.log(`[FEW-SHOT] Usuário ${userId}: ${(data || []).length} correções carregadas`);

  return (data || []) as UserCorrection[];
}

/**
 * Salva ou atualiza uma correção do usuário.
 * Faz UPSERT na tabela user_corrections.
 */
export async function saveUserCorrection(
  userId: string,
  descricaoRaw: string,
  categoriaCorreta: string,
  subcategoriaCorreta?: string | null
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("user_corrections")
    .upsert(
      {
        user_id: userId,
        descricao_raw: descricaoRaw,
        categoria_correta: categoriaCorreta,
        subcategoria_correta: subcategoriaCorreta || null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,descricao_raw",
        ignoreDuplicates: false,
      }
    );

  if (error) {
    console.error("[FEW-SHOT] Erro ao salvar correção:", error);
    return false;
  }

  console.log(`[FEW-SHOT] Correção salva: "${descricaoRaw}" → ${categoriaCorreta}`);
  return true;
}
