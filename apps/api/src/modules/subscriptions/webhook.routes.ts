import { FastifyPluginAsync } from 'fastify'
import { supabaseAdmin } from '../../plugins/supabase'
import { env } from '../../env'

const STATUS_ATIVO = ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED']
const STATUS_ATRASADO = ['PAYMENT_OVERDUE']

const asaasWebhookRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/subscriptions/webhook/asaas', async (request, reply) => {
    // Validar token de segurança enviado pelo Asaas
    const token = request.headers['asaas-access-token']
    if (token !== env.ASAAS_WEBHOOK_TOKEN) {
      console.warn('[Asaas Webhook] Token inválido recebido')
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    reply.status(200).send({ received: true })

    try {
      const body = request.body as any
      const evento = body.event
      const payment = body.payment

      if (!payment?.subscription) return

      let novoStatus: string | null = null
      if (STATUS_ATIVO.includes(evento)) novoStatus = 'active'
      else if (STATUS_ATRASADO.includes(evento)) novoStatus = 'overdue'
      else if (evento === 'PAYMENT_REFUNDED') novoStatus = 'canceled'

      if (!novoStatus) {
        console.log('[Asaas Webhook] Evento não tratado:', evento)
        return
      }

      const { error } = await supabaseAdmin
        .from('subscriptions')
        .update({ status: novoStatus, updated_at: new Date().toISOString() })
        .eq('asaas_subscription_id', payment.subscription)

      if (error) {
        console.error('[Asaas Webhook] Erro ao atualizar assinatura:', error)
      } else {
        console.log(`[Asaas Webhook] Assinatura ${payment.subscription} -> ${novoStatus}`)
      }
    } catch (err: any) {
      console.error('[Asaas Webhook] Erro:', err.message)
    }
  })
}

export default asaasWebhookRoutes