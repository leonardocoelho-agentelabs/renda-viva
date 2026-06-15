import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from "fastify";
import { authHook, requireActiveSubscription } from "../../plugins/auth.js";
import { Queue } from "bullmq";
import { env } from "../../env.js";

interface UploadBody {
  // multipart fields
}

// Criar fila (instância global)
let ocrQueue: Queue | null = null;

function getOcrQueue(): Queue {
  if (!ocrQueue) {
    ocrQueue = new Queue("ocr-queue", {
      connection: {
        host: new URL(env.REDIS_URL).hostname,
        port: parseInt(new URL(env.REDIS_URL).port || "6379"),
        password: new URL(env.REDIS_URL).password || undefined,
      },
    });
  }
  return ocrQueue;
}

const uploadsRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // POST /uploads - Upload de arquivo
  fastify.post<{ Body: UploadBody }>(
    "/",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;

        // Parsear multipart
        const data = await request.file();

        if (!data) {
          return reply.status(400).send({
            success: false,
            error: "Nenhum arquivo enviado",
          });
        }

        // Validar tipo do arquivo
        const filename = data.filename.toLowerCase();
        const allowedTypes = [".csv", ".pdf", ".ofx"];
        const ext = "." + filename.split(".").pop();

        if (!allowedTypes.includes(ext)) {
          return reply.status(400).send({
            success: false,
            error: `Tipo de arquivo não suportado. Use: ${allowedTypes.join(", ")}`,
          });
        }

        // Validar tamanho (20MB)
        const fileBuffer = await data.toBuffer();
        const maxSize = 20 * 1024 * 1024;

        if (fileBuffer.length > maxSize) {
          return reply.status(400).send({
            success: false,
            error: "Arquivo muito grande. Máximo: 20MB",
          });
        }

        // Determinar file_type
        const fileType = ext.replace(".", "") as "csv" | "pdf" | "ofx";

        // Gerar ID do upload
        const uploadId = crypto.randomUUID();

        // Caminho no storage: {user_id}/{upload_id}/{filename}
        const storagePath = `${userId}/${uploadId}/${filename}`;

        // Upload para Supabase Storage
        const { error: uploadError } = await fastify.supabaseAdmin.storage
          .from("extratos")
          .upload(storagePath, fileBuffer, {
            contentType: data.mimetype,
            upsert: true,
          });

        if (uploadError) {
          fastify.log.error("Erro ao fazer upload:", uploadError);
          return reply.status(500).send({
            success: false,
            error: "Erro ao salvar arquivo",
          });
        }

        // Criar registro na tabela uploads
        const { data: uploadRecord, error: dbError } = await fastify.supabaseAdmin
          .from("uploads")
          .insert({
            id: uploadId,
            user_id: userId,
            file_name: filename,
            file_path: storagePath,
            file_type: fileType,
            status: "pending",
          })
          .select()
          .single();

        if (dbError) {
          fastify.log.error("Erro ao criar registro:", dbError);
          return reply.status(500).send({
            success: false,
            error: "Erro ao criar registro de upload",
          });
        }

        // Enfileirar job para processamento OCR
        const queue = getOcrQueue();
        await queue.add("process", {
          uploadId,
          userId,
          fileType,
        }, {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
        });

        fastify.log.info(`Upload ${uploadId} enfileirado para processamento`);

        return reply.status(201).send({
          success: true,
          data: {
            upload_id: uploadId,
            status: "pending",
            message: "Arquivo recebido. Processamento em andamento...",
          },
        });
      } catch (error) {
        fastify.log.error("Erro em POST /uploads:", error);
        return reply.status(500).send({
          success: false,
          error: "Erro interno ao processar upload",
        });
      }
    }
  );

  // GET /uploads/:id/status - Status do upload
  fastify.get<{ Params: { id: string } }>(
    "/:id/status",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const uploadId = request.params.id;

        const { data: upload, error } = await fastify.supabaseAdmin
          .from("uploads")
          .select("status, total_transacoes, transacoes_processadas, error_message")
          .eq("id", uploadId)
          .eq("user_id", userId)
          .single();

        if (error || !upload) {
          return reply.status(404).send({
            success: false,
            error: "Upload não encontrado",
          });
        }

        return reply.send({
          success: true,
          data: {
            status: upload.status,
            total_transacoes: upload.total_transacoes,
            transacoes_processadas: upload.transacoes_processadas,
            error_message: upload.error_message,
          },
        });
      } catch (error) {
        fastify.log.error("Erro em GET /uploads/:id/status:", error);
        return reply.status(500).send({
          success: false,
          error: "Erro interno",
        });
      }
    }
  );

  // GET /uploads - Listar uploads do usuário
  fastify.get(
    "/",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;

        const { data: uploads, error } = await fastify.supabaseAdmin
          .from("uploads")
          .select("id, file_name, file_type, status, total_transacoes, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) {
          fastify.log.error("Erro ao buscar uploads:", error);
          return reply.status(500).send({
            success: false,
            error: "Erro ao buscar uploads",
          });
        }

        return reply.send({
          success: true,
          data: uploads,
        });
      } catch (error) {
        fastify.log.error("Erro em GET /uploads:", error);
        return reply.status(500).send({
          success: false,
          error: "Erro interno",
        });
      }
    }
  );
};

export { uploadsRoutes };