import { FastifyPluginAsync } from 'fastify'
import { supabaseAdmin } from '../../plugins/supabase'
import { normalizarTelefone } from '../../lib/phone'

const usersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/users/me', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, full_name, email, telefone, renda_mensal, perfil_risco')
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
}

export default usersRoutes
