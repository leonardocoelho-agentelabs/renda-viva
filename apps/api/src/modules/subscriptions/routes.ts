import { FastifyPluginAsync } from 'fastify'
import { supabaseAdminAdmin } from '../../plugins/supabaseAdmin'
import { criarClienteAsaas, criarAssinaturaAsaas, buscarLinkPagamento } from '../../services/asaas.service'

const subscriptionsRoutes: FastifyPluginAsync = async (fastify) => {
  // Status da assinatura do usuário logado
  fastify.get('/subscriptions/me', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { data } = await supabaseAdmin
      .from('subscriptions')
      .select('*, plans(nome, preco_mensal, preco_anual)')
      .eq('user_id', request.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return reply.send({ subscription: data })
  })

  // Iniciar checkout
  fastify.post('/subscriptions/checkout', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const body = request.body as { ciclo: 'MONTHLY' | 'YEARLY', cpf: string }

    if (!body.ciclo || !['MONTHLY', 'YEARLY'].includes(body.ciclo)) {
      return reply.status(400).send({ error: 'Ciclo inválido' })
    }

    const cpfLimpo = (body.cpf || '').replace(/\D/g, '')
    if (cpfLimpo.length !== 11) {
      return reply.status(400).send({ error: 'CPF inválido' })
    }

    // Buscar dados do usuário
    const { data: usuario } = await supabaseAdmin
      .from('users')
      .select('id, full_name, email, cpf')
      .eq('id', request.user.id)
      .single()

    if (!usuario) return reply.status(404).send({ error: 'Usuário não encontrado' })

    // Salvar CPF se ainda não tiver
    if (!usuario.cpf) {
      await supabaseAdmin.from('users').update({ cpf: cpfLimpo }).eq('id', usuario.id)
    }

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
      nome: usuario.full_name,
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
}

export default subscriptionsRoutes