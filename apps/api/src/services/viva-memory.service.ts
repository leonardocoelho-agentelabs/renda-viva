import type { SupabaseClient } from "@supabase/supabase-js";

// Buscar memórias relevantes para injetar no prompt
export async function getVivaMemory(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const { data: memories } = await supabase
    .from("viva_memory")
    .select("tipo, titulo, conteudo, importancia")
    .eq("user_id", userId)
    .eq("ativo", true)
    .order("importancia", { ascending: false })
    .order("ultima_referencia", { ascending: false })
    .limit(20);

  if (!memories || memories.length === 0) return "";

  const memoriaTexto = memories
    .map((m) => `[${m.tipo.toUpperCase()}] ${m.titulo}: ${m.conteudo}`)
    .join("\n");

  return `\nMEMÓRIAS IMPORTANTES SOBRE ESTE USUÁRIO:\n${memoriaTexto}\n`;
}

// Extrair e salvar novas memórias de uma conversa
export async function extractAndSaveMemories(
  supabase: SupabaseClient,
  userId: string,
  mensagemUsuario: string,
  respostaViva: string
): Promise<void> {
  // Usar Claude Haiku para extrair memórias relevantes
  const prompt = `
Analise esta conversa entre usuário e assistente financeiro.
Identifique informações importantes para lembrar futuramente.

Mensagem do usuário: "${mensagemUsuario}"
Resposta da Viva: "${respostaViva}"

Retorne SOMENTE um JSON válido no formato:
{
  "memorias": [
    {
      "tipo": "objetivo_vida|decisao_importante|conquista|comportamento|preferencia|contexto_pessoal|alerta_recorrente",
      "titulo": "resumo em até 10 palavras",
      "conteudo": "descrição detalhada em até 100 palavras",
      "importancia": 1-10
    }
  ]
}

Se não houver informação relevante para memorizar, retorne:
{"memorias": []}

Só memorize informações REALMENTE importantes e duradouras.
Não memorize perguntas pontuais ou dados que já estão nas transações.
`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.CLAUDE_API_KEY!,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      console.error("[VIVA MEMORY] Erro ao chamar API Claude:", response.status);
      return;
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || "{}";

    let resultado: { memorias: any[] };
    try {
      resultado = JSON.parse(text.replace(/```json|```/g, "").trim());
    } catch {
      console.error("[VIVA MEMORY] Erro ao fazer parse do JSON:", text);
      return;
    }

    if (!resultado.memorias || resultado.memorias.length === 0) return;

    for (const memoria of resultado.memorias) {
      // Verificar se memória similar já existe (upsert por titulo)
      const { data: existing } = await supabase
        .from("viva_memory")
        .select("id")
        .eq("user_id", userId)
        .eq("titulo", memoria.titulo)
        .single();

      if (existing) {
        await supabase
          .from("viva_memory")
          .update({
            conteudo: memoria.conteudo,
            importancia: memoria.importancia,
            ultima_referencia: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("viva_memory").insert({
          user_id: userId,
          ...memoria,
        });
      }
    }

    console.log(
      `[VIVA MEMORY] ${resultado.memorias.length} memórias salvas para user ${userId}`
    );
  } catch (error) {
    console.error("[VIVA MEMORY] Erro ao extrair memórias:", error);
  }
}