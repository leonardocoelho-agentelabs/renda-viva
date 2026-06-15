import { FastifyPluginAsync } from 'fastify'
import { createClient } from '@supabase/supabase-js'
import { env } from '../../env.js'

const deleteAccountRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.delete('/users/me', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    // Cliente admin com service role key (necessário para deletar de auth.users)
    const adminClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

    const { error } = await adminClient.auth.admin.deleteUser(request.user.id)

    if (error) {
      fastify.log.error('[Delete Account] Erro:', error)
      return reply.status(500).send({ error: 'Erro ao excluir conta' })
    }

    // Dados em public.users e outras tabelas são removidos via ON DELETE CASCADE
    // nas foreign keys referenciando auth.users(id)
    return reply.send({ success: true })
  })
}

export default deleteAccountRoutes
