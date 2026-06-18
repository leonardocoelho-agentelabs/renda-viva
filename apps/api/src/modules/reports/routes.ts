import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { authHook, requireActiveSubscription } from "../../plugins/auth.js";
import { env } from "../../env.js";
import {
  gerarRelatorioMensal,
  gerarESalvarRelatorio,
  RELATORIOS_BUCKET,
} from "./service.js";
import { gerarRelatorioIR } from "./ir-service.js";

interface GenerateBody {
  mes_ano?: string;
}

const reportsRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // POST /reports/generate - Gera e salva o relatório do mês (default: mês anterior)
  fastify.post<{ Body: GenerateBody }>(
    "/generate",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const { relatorio, mes_ano } = await gerarESalvarRelatorio(
          userId,
          request.body?.mes_ano
        );
        return reply.send({ relatorio, mes_ano });
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em POST /reports/generate");
        return reply.status(500).send({
          success: false,
          error: "Erro ao gerar relatório",
        });
      }
    }
  );

  // GET /reports/list - Lista relatórios disponíveis do usuário
  fastify.get(
    "/list",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;

        const { data: arquivos, error } = await fastify.supabaseAdmin.storage
          .from(RELATORIOS_BUCKET)
          .list(userId, { sortBy: { column: "name", order: "desc" } });

        if (error) {
          fastify.log.error({ err: error }, "Erro ao listar relatórios");
          return reply.status(500).send({
            success: false,
            error: "Erro ao listar relatórios",
          });
        }

        const relatorios = (arquivos || [])
          .filter((f) => f.name.endsWith(".md"))
          .map((f) => ({
            mes_ano: f.name.replace(/\.md$/, ""),
            gerado_em: f.updated_at || f.created_at || null,
          }));

        return reply.send(relatorios);
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em GET /reports/list");
        return reply.status(500).send({
          success: false,
          error: "Erro ao listar relatórios",
        });
      }
    }
  );

  // GET /reports/:mes_ano - Busca o conteúdo de um relatório específico
  fastify.get<{ Params: { mes_ano: string } }>(
    "/:mes_ano",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const mesAno = request.params.mes_ano;

        if (!/^\d{4}-\d{2}$/.test(mesAno)) {
          return reply.status(400).send({
            success: false,
            error: "Formato de mês inválido. Use AAAA-MM.",
          });
        }

        const { data, error } = await fastify.supabaseAdmin.storage
          .from(RELATORIOS_BUCKET)
          .download(`${userId}/${mesAno}.md`);

        if (error || !data) {
          return reply.status(404).send({
            success: false,
            error: "Relatório não encontrado",
          });
        }

        const relatorio = await data.text();
        return reply.send({ relatorio, mes_ano: mesAno });
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em GET /reports/:mes_ano");
        return reply.status(500).send({
          success: false,
          error: "Erro ao buscar relatório",
        });
      }
    }
  );

  // GET /reports/users-active - (interno) lista usuários ativos para o n8n
  fastify.get(
    "/users-active",
    async (request, reply) => {
      if (request.headers["x-api-secret"] !== env.API_SECRET) {
        return reply.status(401).send({ success: false, error: "Não autorizado" });
      }

      const { data: usuarios, error } = await fastify.supabaseAdmin
        .from("users")
        .select("id, email, full_name");

      if (error) {
        return reply.status(500).send({ success: false, error: "Erro ao listar usuários" });
      }

      return reply.send(usuarios || []);
    }
  );

  // POST /reports/generate-all - (interno) gera relatório para todos os usuários
  fastify.post<{ Body: GenerateBody }>(
    "/generate-all",
    async (request, reply) => {
      if (request.headers["x-api-secret"] !== env.API_SECRET) {
        return reply.status(401).send({ success: false, error: "Não autorizado" });
      }

      const { data: usuarios, error } = await fastify.supabaseAdmin
        .from("users")
        .select("id");

      if (error) {
        return reply.status(500).send({ success: false, error: "Erro ao listar usuários" });
      }

      let processados = 0;
      let erros = 0;

      for (const u of usuarios || []) {
        try {
          await gerarESalvarRelatorio(u.id, request.body?.mes_ano);
          processados++;
        } catch (e) {
          erros++;
          fastify.log.error({ err: e, userId: u.id }, "Erro ao gerar relatório em lote");
        }
      }

      return reply.send({ processados, erros });
    }
  );

  // GET /reports/ir/:ano - Gera relatório de IR para o ano fiscal
  fastify.get<{ Params: { ano: string } }>(
    "/ir/:ano",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const ano = parseInt(request.params.ano, 10);

        if (isNaN(ano) || ano < 2000 || ano > new Date().getFullYear()) {
          return reply.status(400).send({
            success: false,
            error: "Ano inválido. Use um ano entre 2000 e o ano atual.",
          });
        }

        const relatorio = await gerarRelatorioIR(userId, ano);
        return reply.send(relatorio);
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em GET /reports/ir/:ano");
        return reply.status(500).send({
          success: false,
          error: "Erro ao gerar relatório de IR",
        });
      }
    }
  );

  // POST /reports/ir/:ano/download - Baixa relatório de IR como JSON
  fastify.post<{ Params: { ano: string } }>(
    "/ir/:ano/download",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const ano = parseInt(request.params.ano, 10);

        if (isNaN(ano) || ano < 2000 || ano > new Date().getFullYear()) {
          return reply.status(400).send({
            success: false,
            error: "Ano inválido. Use um ano entre 2000 e o ano atual.",
          });
        }

        const relatorio = await gerarRelatorioIR(userId, ano);

        return reply
          .header(
            "Content-Disposition",
            `attachment; filename="IR-${ano}-RendaViva.json"`
          )
          .header("Content-Type", "application/json")
          .send(relatorio);
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em POST /reports/ir/:ano/download");
        return reply.status(500).send({
          success: false,
          error: "Erro ao gerar relatório de IR para download",
        });
      }
    }
  );
};

export { reportsRoutes, gerarRelatorioMensal };
export default reportsRoutes;
