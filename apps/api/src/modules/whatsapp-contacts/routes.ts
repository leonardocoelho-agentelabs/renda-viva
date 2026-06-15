import { FastifyPluginAsync } from 'fastify'
import { supabaseAdmin } from '../../plugins/supabase'
import { normalizarTelefone } from '../../lib/phone'

const whatsappContactsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/whatsapp-contacts', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { data, error } = await supabaseAdmin
      .from('whatsapp_contacts')
      .select('id, telefone, nome, created_at')
      .eq('user_id', request.user.id)
      .order('created_at', { ascending: true })

    if (error) return reply.status(500).send({ error: 'Erro ao buscar contatos' })
    return reply.send({ contatos: data })
  })

  fastify.post('/whatsapp-contacts', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const body = request.body as { telefone: string, nome: string }

    if (!body.telefone || !body.nome?.trim()) {
      return reply.status(400).send({ error: 'Telefone e nome são obrigatórios' })
    }

    const telefoneNormalizado = normalizarTelefone(body.telefone)

    if (telefoneNormalizado.length < 10 || telefoneNormalizado.length > 11) {
      return reply.status(400).send({ error: 'Número de telefone inválido' })
    }

    const { data, error } = await supabaseAdmin
      .from('whatsapp_contacts')
      .insert({
        user_id: request.user.id,
        telefone: telefoneNormalizado,
        nome: body.nome.trim()
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return reply.status(409).send({ error: 'Este número já está vinculado a uma conta' })
      }
      return reply.status(500).send({ error: 'Erro ao adicionar contato' })
    }

    return reply.send({ contato: data })
  })

  fastify.delete('/whatsapp-contacts/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const { error } = await supabaseAdmin
      .from('whatsapp_contacts')
      .delete()
      .eq('id', id)
      .eq('user_id', request.user.id)

    if (error) return reply.status(500).send({ error: 'Erro ao remover contato' })
    return reply.send({ success: true })
  })
}

export default whatsappContactsRoutes
