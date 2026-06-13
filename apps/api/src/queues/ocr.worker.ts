import { Queue, Worker } from "bullmq";
import { env } from "../env.js";
import { processUpload } from "../modules/uploads/service.js";

interface OcrJobData {
  uploadId: string;
  userId: string;
  fileType: "csv" | "pdf";
}

// Configuração da conexão Redis
const connection = {
  host: new URL(env.REDIS_URL).hostname,
  port: parseInt(new URL(env.REDIS_URL).port || "6379"),
  password: new URL(env.REDIS_URL).password || undefined,
};

// Criar fila
export const ocrQueue = new Queue<OcrJobData>("ocr-queue", { connection });

// Criar worker
export const ocrWorker = new Worker<OcrJobData>(
  "ocr-queue",
  async (job) => {
    console.log(`🚀 Processando job ${job.id}:`, job.data);

    const { uploadId, userId, fileType } = job.data;

    await processUpload(uploadId, userId, fileType);

    // Recalcular score do usuário após processar o extrato
    try {
      const { calcularScore } = await import("../modules/score/service.js");
      await calcularScore(userId);
      console.log("[OCR Worker] Score recalculado para usuário:", userId);
    } catch (e) {
      console.error("[OCR Worker] Erro ao recalcular score:", e);
    }

    // Verificar gastos incomuns nas transações deste upload (gastos > R$ 50)
    try {
      const { supabaseAdmin } = await import("../plugins/supabase.js");
      const { verificarGastoIncomum } = await import("../services/alerts.service.js");

      const { data: novas } = await supabaseAdmin
        .from("transactions")
        .select("descricao_raw, valor, categoria")
        .eq("upload_id", uploadId)
        .lt("valor", -50);

      for (const t of novas || []) {
        if (!t.categoria) continue;
        await verificarGastoIncomum(userId, {
          descricao_raw: t.descricao_raw,
          valor: Number(t.valor),
          categoria: t.categoria,
        });
      }
    } catch (e) {
      console.error("[OCR Worker] Erro ao verificar gasto incomum:", e);
    }

    return { success: true, uploadId };
  },
  {
    connection,
    concurrency: 2,
    limiter: {
      max: 10,
      duration: 60000, // 10 jobs por minuto
    },
  }
);

// Eventos do worker
ocrWorker.on("completed", (job, result) => {
  console.log(`✅ Job ${job.id} completado:`, result);
});

ocrWorker.on("failed", (job, err) => {
  console.error(`❌ Job ${job?.id} falhou:`, err.message);
});

ocrWorker.on("progress", (job, progress) => {
  console.log(`📊 Job ${job.id} progresso: ${progress}%`);
});

// Graceful shutdown
const shutdown = async () => {
  console.log("\n🛑 Encerrando worker...");
  await ocrWorker.close();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

console.log("👷 OCR Worker iniciado e aguardando jobs...");