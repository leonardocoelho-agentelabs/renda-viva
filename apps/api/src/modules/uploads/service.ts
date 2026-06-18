import { parseCSV } from "./parsers/csv.parser.js";
import { parsePDF } from "./parsers/pdf.parser.js";
import { getClaudeService } from "../../services/claude.service.js";
import { supabaseAdmin } from "../../plugins/supabase.js";
import { getUserCorrections } from "../../services/corrections.service.js";

export interface UploadResult {
  uploadId: string;
  status: string;
  message: string;
  totalTransacoes?: number;
}

export interface UploadStatus {
  status: string;
  total_transacoes: number;
  transacoes_processadas: number;
  error_message: string | null;
}

export async function processUpload(uploadId: string, userId: string, fileType: "csv" | "pdf"): Promise<void> {
  // Reusa o cliente compartilhado do plugin, que já tem o transport ws
  // configurado (necessário no Node.js 20, sem WebSocket nativo).
  const supabase = supabaseAdmin;
  const claude = getClaudeService();

  console.log("[OCR Worker] Job iniciado:", { uploadId, userId, fileType });

  try {
    // 1. Buscar info do upload
    const { data: upload, error: uploadError } = await supabase
      .from("uploads")
      .select("*")
      .eq("id", uploadId)
      .single();

    if (uploadError || !upload) {
      throw new Error(`Upload não encontrado: ${uploadError?.message ?? "registro ausente"}`);
    }
    console.log("[OCR Worker] Upload localizado:", { file_path: upload.file_path });

    // 2. Atualizar status para processing (antes do download para refletir o início)
    await supabase
      .from("uploads")
      .update({ status: "processing" })
      .eq("id", uploadId);

    // 3. Baixar arquivo do Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("extratos")
      .download(upload.file_path);

    if (downloadError || !fileData) {
      throw new Error(`Erro ao baixar arquivo: ${downloadError?.message}`);
    }

    // 4. Parsear arquivo
    const buffer = Buffer.from(await fileData.arrayBuffer());
    console.log("[OCR Worker] Arquivo baixado:", { bytes: buffer.length });

    let transacoes;
    if (fileType === "csv") {
      transacoes = await parseCSV(buffer);
    } else {
      transacoes = await parsePDF(buffer);
    }

    console.log("[OCR Worker] Transações parseadas:", { count: transacoes.length });

    if (transacoes.length === 0) {
      await supabase
        .from("uploads")
        .update({
          status: "done",
          total_transacoes: 0,
          transacoes_processadas: 0,
          error_message: "Nenhuma transação encontrada no arquivo",
        })
        .eq("id", uploadId);
      console.log("[OCR Worker] Nenhuma transação encontrada, finalizando.");
      return;
    }

    // 5. Setar total_transacoes IMEDIATAMENTE após o parse.
    // Sem isso, o frontend calcula progresso com total=0 e fica preso em 50%.
    await supabase
      .from("uploads")
      .update({ total_transacoes: transacoes.length, transacoes_processadas: 0 })
      .eq("id", uploadId);

    // 7. Buscar correções do usuário para few-shot (UMA vez, antes do loop)
    const correcoesFormatadas = await getUserCorrections(userId);

    if (correcoesFormatadas.length > 0) {
      console.log(`[FEW-SHOT] Aplicando ${correcoesFormatadas.length} exemplos no prompt de categorização`);
    }

    // 6. Limpar transações de tentativas anteriores deste mesmo upload.
    // Isso garante que retries não dupliquem dados — cada tentativa começa do zero.
    const { error: deleteError } = await supabase
      .from("transactions")
      .delete()
      .eq("upload_id", uploadId);

    if (deleteError) {
      console.warn("[OCR Worker] Aviso ao limpar transações anteriores:", deleteError.message);
    }
    console.log("[OCR Worker] Transações anteriores limpas para upload:", uploadId);

    // 8. Inserir transações brutas na tabela
    const transacoesParaInserir = transacoes.map((t) => ({
      user_id: userId,
      data: t.data,
      valor: t.valor,
      descricao_raw: t.descricao_raw,
      tipo: t.tipo === "credito" ? "credito" : "debito",
      status_revisao: "pendente",
      upload_id: uploadId,
      origem: fileType === "csv" ? "csv" : "pdf",
    }));

    const { data: insertedTransactions, error: insertError } = await supabase
      .from("transactions")
      .insert(transacoesParaInserir)
      .select("id, descricao_raw");

    if (insertError) {
      throw new Error(`Erro ao inserir transações: ${insertError.message}`);
    }
    console.log("[OCR Worker] Transações inseridas no banco:", { count: insertedTransactions?.length ?? 0 });

    // 9. Categorizar em batches de 20
    let processadas = 0;
    const batchSize = 20;

    for (let i = 0; i < transacoes.length; i += batchSize) {
      const batch = transacoes.slice(i, i + batchSize);

      // O claudeService já faz retry interno e tem fallback ("Outros"), mas
      // protegemos o batch para que uma falha de categorização nunca trave o job.
      let categorized: Awaited<ReturnType<typeof claude.categorizarTransacoes>> = [];
      try {
        categorized = await claude.categorizarTransacoes(batch, correcoesFormatadas);
      } catch (claudeError) {
        console.error("[OCR Worker] Erro no Claude (batch ignorado):", {
          error: claudeError instanceof Error ? claudeError.message : claudeError,
        });
      }

      // Atualizar cada transação com a categoria
      for (let j = 0; j < categorized.length; j++) {
        const cat = categorized[j];
        const transactionId = insertedTransactions?.[i + j]?.id;

        if (transactionId) {
          // Definir status baseado no score
          let status: string;
          if (cat.score >= 0.9) {
            status = "aprovado";
          } else if (cat.score >= 0.7) {
            status = "revisar";
          } else {
            status = "pendente";
          }

          await supabase
            .from("transactions")
            .update({
              categoria: cat.categoria,
              subcategoria: cat.subcategoria,
              score_confianca: cat.score,
              is_recorrente: cat.is_recorrente,
              status_revisao: status,
            })
            .eq("id", transactionId);
        }

        processadas++;
      }

      // Atualizar progresso
      await supabase
        .from("uploads")
        .update({ transacoes_processadas: processadas })
        .eq("id", uploadId);

      console.log("[OCR Worker] Progresso:", { processadas, total: transacoes.length });
    }

    // 10. Marcar como concluído
    await supabase
      .from("uploads")
      .update({
        status: "done",
        total_transacoes: transacoes.length,
        transacoes_processadas: transacoes.length,
      })
      .eq("id", uploadId);

    console.log("[OCR Worker] Job concluído com sucesso:", {
      uploadId,
      total: transacoes.length,
    });
  } catch (error) {
    console.error("[OCR Worker] ERRO FATAL:", {
      uploadId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Marcar como erro
    await supabase
      .from("uploads")
      .update({
        status: "error",
        error_message: error instanceof Error ? error.message : "Erro desconhecido",
      })
      .eq("id", uploadId);
  }
}