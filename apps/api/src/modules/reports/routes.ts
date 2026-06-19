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

        // Salvar/atualizar relatório de IR no banco
        const totalDeducoes = relatorio.analise_ia?.deducoes_possiveis
          ? Object.values(relatorio.analise_ia.deducoes_possiveis as Record<string, { total?: number }>)
              .reduce((s: number, d) => s + (d.total || 0), 0)
          : 0;

        const { error: saveError } = await fastify.supabaseAdmin
          .from("ir_reports")
          .upsert({
            user_id: userId,
            ano: Number(request.params.ano),
            dados: relatorio,
            resumo_executivo: relatorio.analise_ia?.resumo_executivo,
            alerta_declaracao: relatorio.analise_ia?.alerta_declaracao,
            total_rendimentos: relatorio.rendimentos?.total_geral,
            total_deducoes: totalDeducoes,
            imposto_estimado: relatorio.analise_ia?.imposto_estimado,
          }, {
            onConflict: "user_id,ano",
          });

        if (saveError) {
          console.error("[IR] Erro ao salvar relatório:", saveError);
        }

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

  // GET /reports/ir/historico - Lista todos os relatórios de IR do usuário
  fastify.get(
    "/ir/historico",
    { preHandler: [authHook, requireActiveSubscription] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;

        const { data: historico, error } = await fastify.supabaseAdmin
          .from("ir_reports")
          .select("id, ano, total_rendimentos, total_deducoes, imposto_estimado, created_at")
          .eq("user_id", userId)
          .order("ano", { ascending: false });

        if (error) {
          fastify.log.error({ err: error }, "Erro ao buscar histórico de IR");
          return reply.status(500).send({
            success: false,
            error: "Erro ao buscar histórico de relatórios",
          });
        }

        return reply.send({ historico: historico || [] });
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em GET /reports/ir/historico");
        return reply.status(500).send({
          success: false,
          error: "Erro ao buscar histórico de relatórios",
        });
      }
    }
  );

  // GET /reports/ir/historico/:ano - Retorna relatório completo de um ano específico
  fastify.get<{ Params: { ano: string } }>(
    "/ir/historico/:ano",
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

        const { data: relatorio, error } = await fastify.supabaseAdmin
          .from("ir_reports")
          .select("*")
          .eq("user_id", userId)
          .eq("ano", ano)
          .single();

        if (error || !relatorio) {
          return reply.status(404).send({
            success: false,
            error: "Relatório não encontrado para este ano",
          });
        }

        return reply.send(relatorio.dados);
      } catch (error) {
        fastify.log.error({ err: error }, "Erro em GET /reports/ir/historico/:ano");
        return reply.status(500).send({
          success: false,
          error: "Erro ao buscar relatório",
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
