import { FastifyPluginAsync } from 'fastify'
import { supabaseAdmin } from '../../plugins/supabase'
import { criarClienteAsaas, criarAssinaturaAsaas, buscarLinkPagamento, cancelarAssinaturaAsaas } from '../../services/asaas.service'

const subscriptionsRoutes: FastifyPluginAsync = async (fastify) => {
  // Status da assinatura do usuário logado
  fastify.get('/subscriptions/me', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { data: usuario } = await supabaseAdmin
      .from('users')
      .select('acesso_liberado')
      .eq('id', request.user.id)
      .single()

    const { data } = await supabaseAdmin
      .from('subscriptions')
      .select('*, plans(nome, preco_mensal, preco_anual)')
      .eq('user_id', request.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const statusComAcesso = ['active', 'overdue']
    const temAcesso = !!usuario?.acesso_liberado || (!!data && statusComAcesso.includes(data.status))

    return reply.send({ subscription: data, temAcesso, acessoLiberado: !!usuario?.acesso_liberado })
  })

  // Iniciar checkout
  fastify.post('/subscriptions/checkout', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const body = request.body as {
      ciclo: 'MONTHLY' | 'YEARLY',
      cpf: string,
      nome: string,
      telefone: string
    }

    if (!body.ciclo || !['MONTHLY', 'YEARLY'].includes(body.ciclo)) {
      return reply.status(400).send({ error: 'Ciclo inválido' })
    }

    const cpfLimpo = (body.cpf || '').replace(/\D/g, '')
    if (cpfLimpo.length !== 11) {
      return reply.status(400).send({ error: 'CPF inválido' })
    }

    if (!body.nome?.trim()) {
      return reply.status(400).send({ error: 'Nome é obrigatório' })
    }

    const telefoneLimpo = (body.telefone || '').replace(/\D/g, '')
    if (telefoneLimpo.length < 10 || telefoneLimpo.length > 11) {
      return reply.status(400).send({ error: 'WhatsApp inválido' })
    }

    // Buscar dados do usuário
    const { data: usuario } = await supabaseAdmin
      .from('users')
      .select('id, full_name, email, cpf')
      .eq('id', request.user.id)
      .single()

    if (!usuario) return reply.status(404).send({ error: 'Usuário não encontrado' })

    // Atualizar dados do usuário (lead capture)
    await supabaseAdmin
      .from('users')
      .update({
        cpf: cpfLimpo,
        full_name: body.nome.trim(),
        telefone: telefoneLimpo
      })
      .eq('id', request.user.id)

    // Verificar se já existe assinatura pendente com mesmo ciclo
    const { data: existente } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', usuario.id)
      .eq('status', 'pending')
      .eq('ciclo', body.ciclo)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existente?.invoice_url) {
      return reply.send({ invoiceUrl: existente.invoice_url })
    }

    // Buscar plano
    const { data: plano } = await supabaseAdmin
      .from('plans')
      .select('*')
      .eq('ativo', true)
      .limit(1)
      .single()

    if (!plano) return reply.status(500).send({ error: 'Nenhum plano disponível' })

    const valor = body.ciclo === 'MONTHLY' ? plano.preco_mensal : plano.preco_anual

    // Criar cliente no Asaas
    const cliente = await criarClienteAsaas({
      nome: body.nome.trim(),
      email: usuario.email,
      cpf: cpfLimpo
    })

    // Criar assinatura
    const assinatura = await criarAssinaturaAsaas({
      customerId: cliente.id,
      valor,
      ciclo: body.ciclo
    })

    // Buscar link de pagamento
    const invoiceUrl = await buscarLinkPagamento(assinatura.id)

    // Salvar no banco
    await supabaseAdmin.from('subscriptions').insert({
      user_id: usuario.id,
      plan_id: plano.id,
      ciclo: body.ciclo,
      valor,
      status: 'pending',
      asaas_customer_id: cliente.id,
      asaas_subscription_id: assinatura.id,
      invoice_url: invoiceUrl,
      proxima_cobranca: assinatura.nextDueDate
    })

    return reply.send({ invoiceUrl })
  })

  // Cancelar assinatura
  fastify.post('/subscriptions/cancel', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const userId = request.user.id

    // Verificar se usuário tem acesso de fundador (sem assinatura)
    const { data: usuario } = await supabaseAdmin
      .from('users')
      .select('acesso_liberado')
      .eq('id', userId)
      .single()

    if (usuario?.acesso_liberado) {
      return reply.status(400).send({
        error: 'Sua conta tem acesso de fundador e não possui assinatura para cancelar'
      })
    }

    // Buscar assinatura ativa
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle()

    if (!subscription) {
      return reply.status(404).send({ error: 'Nenhuma assinatura ativa encontrada' })
    }

    // Tentar cancelar no Asaas (mas não bloquear se falhar)
    if (subscription.asaas_subscription_id) {
      await cancelarAssinaturaAsaas(subscription.asaas_subscription_id)
    }

    // Atualizar status no banco
    const { error: updateError } = await supabaseAdmin
      .from('subscriptions')
      .update({
        status: 'canceled',
        cancelado_em: new Date().toISOString()
      })
      .eq('id', subscription.id)

    if (updateError) {
      console.error('[Subscriptions] Erro ao atualizar status de cancelamento:', updateError)
      return reply.status(500).send({ error: 'Erro ao cancelar assinatura' })
    }

    return reply.send({ success: true, message: 'Assinatura cancelada com sucesso' })
  })
}

export default subscriptionsRoutes