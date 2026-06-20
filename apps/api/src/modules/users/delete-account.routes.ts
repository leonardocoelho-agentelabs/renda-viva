import { FastifyPluginAsync } from 'fastify'

const deleteAccountRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.delete('/users/me', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const userId = request.user.id

    fastify.log.info({ userId }, '[Delete Account] Iniciando exclusão completa do usuário')

    // Deletar do Supabase Auth (último passo - critical)
    const { error: authError } = await fastify.supabaseAdmin.auth.admin.deleteUser(userId)

    if (authError) {
      fastify.log.error({ err: authError, userId }, '[Delete Account] Erro ao deletar usuário do Auth')
      return reply.status(500).send({ success: false, error: 'Erro ao finalizar exclusão da conta' })
    }

    // Dados em public.users e outras tabelas são removidos via ON DELETE CASCADE
    // nas foreign keys referenciando auth.users(id) e public.users(id)

    fastify.log.info({ userId }, '[Delete Account] Usuário completamente excluído (Auth + dados via CASCADE)')

    return reply.send({ success: true, message: 'Conta excluída com sucesso' })
  })
}

export default deleteAccountRoutes
