import { FastifyPluginAsync } from 'fastify'
import { supabaseAdmin } from '../../plugins/supabase'
import { env } from '../../env'
import { enviarEventoPurchaseMeta } from '../../services/meta-conversions.service'

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

        // Tracking server-side (Meta Conversions API): disparar Purchase apenas
        // na PRIMEIRA confirmação de pagamento (não em renovações mensais).
        // Fire-and-forget: qualquer falha é capturada pelo catch externo e não
        // afeta a resposta do webhook (já enviada acima com status 200).
        if (novoStatus === 'active') {
          const { data: subscriptionData } = await supabaseAdmin
            .from('subscriptions')
            .select('id, user_id, valor, asaas_subscription_id, status, purchase_event_enviado, users(email)')
            .eq('asaas_subscription_id', payment.subscription)
            .single()

          const jaEnviado = (subscriptionData as any)?.purchase_event_enviado
          const userEmail = (subscriptionData as any)?.users?.email

          if (subscriptionData && userEmail && !jaEnviado) {
            await enviarEventoPurchaseMeta({
              email: userEmail,
              valor: Number((subscriptionData as any).valor),
              eventId: (subscriptionData as any).asaas_subscription_id,
            })

            // Marcar como enviado para não duplicar em renovações futuras
            await supabaseAdmin
              .from('subscriptions')
              .update({ purchase_event_enviado: true })
              .eq('id', (subscriptionData as any).id)
          }
        }
      }
    } catch (err: any) {
      console.error('[Asaas Webhook] Erro:', err.message)
    }
  })
}

export default asaasWebhookRoutes