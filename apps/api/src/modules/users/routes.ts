import { FastifyPluginAsync } from 'fastify'
import { supabaseAdmin } from '../../plugins/supabase'
import { normalizarTelefone } from '../../lib/phone'

const usersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/users/me', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, full_name, email, cpf, telefone, renda_mensal, perfil_risco')
      .eq('id', request.user.id)
      .single()

    if (error) return reply.status(500).send({ error: 'Erro ao buscar perfil' })
    return reply.send({ user: data })
  })

  fastify.patch('/users/me', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const body = request.body as { telefone?: string, renda_mensal?: number, perfil_risco?: string }

    const updates: Record<string, any> = {}
    if (body.telefone !== undefined) {
      updates.telefone = normalizarTelefone(body.telefone)
    }
    if (body.renda_mensal !== undefined) updates.renda_mensal = body.renda_mensal
    if (body.perfil_risco !== undefined) updates.perfil_risco = body.perfil_risco

    const { data, error } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', request.user.id)
      .select()
      .single()

    if (error) return reply.status(500).send({ error: 'Erro ao atualizar perfil' })
    return reply.send({ user: data })
  })

  // Exportar dados do usuário (LGPD)
  fastify.get('/users/export', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const userId = request.user.id

    // Buscar dados pessoais (sem dados sensíveis)
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('full_name, email, renda_mensal, perfil_risco, created_at')
      .eq('id', userId)
      .single()

    if (!user) {
      return reply.status(404).send({ error: 'Usuário não encontrado' })
    }

    // Buscar transações
    const { data: transactions } = await supabaseAdmin
      .from('transactions')
      .select('data, descricao_raw, valor, categoria, subcategoria, tipo, origem, registrado_por')
      .eq('user_id', userId)
      .order('data', { ascending: false })

    // Buscar orçamentos
    const { data: budgets } = await supabaseAdmin
      .from('budgets')
      .select('*')
      .eq('user_id', userId)

    // Buscar metas
    const { data: goals } = await supabaseAdmin
      .from('goals')
      .select('*')
      .eq('user_id', userId)

    // Buscar compromissos recorrentes
    const { data: recurring } = await supabaseAdmin
      .from('recurring_commitments')
      .select('*')
      .eq('user_id', userId)

    // Buscar correções de categorias
    const { data: corrections } = await supabaseAdmin
      .from('user_corrections')
      .select('*')
      .eq('user_id', userId)

    // Buscar contatos WhatsApp
    const { data: whatsapp } = await supabaseAdmin
      .from('whatsapp_contacts')
      .select('nome, telefone, created_at')
      .eq('user_id', userId)

    // Buscar assinatura (sem dados sensíveis de cartão)
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('plan_id, ciclo, valor, status, created_at, cancelado_em')
      .eq('user_id', userId)
      .maybeSingle()

    const exportData = {
      exportado_em: new Date().toISOString(),
      versao: '1.0',
      aviso: 'Dados exportados conforme Lei Geral de Proteção de Dados (LGPD) — Lei 13.709/2018',

      perfil: {
        nome: user.full_name,
        email: user.email,
        renda_mensal: user.renda_mensal,
        perfil_risco: user.perfil_risco,
        criado_em: user.created_at
      },

      resumo: {
        total_transacoes: transactions?.length || 0,
        total_metas: goals?.length || 0,
        total_compromissos_recorrentes: recurring?.length || 0,
      },

      transacoes: transactions?.map(t => ({
        data: t.data,
        descricao: t.descricao_raw,
        valor: t.valor,
        categoria: t.categoria,
        subcategoria: t.subcategoria,
        tipo: t.tipo,
        origem: t.origem,
        registrado_por: t.registrado_por
      })) || [],

      orcamentos: budgets || [],
      metas: goals || [],
      compromissos_recorrentes: recurring || [],
      contatos_whatsapp: whatsapp || [],
      correcoes_de_categoria: corrections || [],
      assinatura: subscription
    }

    // Log da exportação
    console.log(`[LGPD] Exportação de dados: user ${userId} em ${new Date().toISOString()}`)

    return reply
      .header('Content-Type', 'application/json')
      .header('Content-Disposition', `attachment; filename="renda-viva-dados-${userId}-${Date.now()}.json"`)
      .send(JSON.stringify(exportData, null, 2))
  })
}

export default usersRoutes
