import { env } from '../env'

const headers = {
  'Content-Type': 'application/json',
  'access_token': env.ASAAS_API_KEY
}

export interface AsaasCustomer {
  id: string
  name: string
  email: string
  cpfCnpj: string
}

export async function criarClienteAsaas(params: {
  nome: string, email: string, cpf: string
}): Promise<AsaasCustomer> {
  const response = await fetch(`${env.ASAAS_API_URL}/customers`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: params.nome,
      email: params.email,
      cpfCnpj: params.cpf.replace(/\D/g, '')
    })
  })

  if (!response.ok) {
    const erro = await response.text()
    console.error('[Asaas] Erro ao criar cliente:', response.status, erro)
    throw new Error('Erro ao criar cliente no Asaas')
  }

  return response.json()
}

export interface AsaasSubscription {
  id: string
  customer: string
  status: string
  nextDueDate: string
}

export async function criarAssinaturaAsaas(params: {
  customerId: string
  valor: number
  ciclo: 'MONTHLY' | 'YEARLY'
}): Promise<AsaasSubscription> {
  const hoje = new Date().toISOString().split('T')[0]

  const response = await fetch(`${env.ASAAS_API_URL}/subscriptions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      customer: params.customerId,
      billingType: 'UNDEFINED',
      value: params.valor,
      cycle: params.ciclo,
      nextDueDate: hoje,
      description: 'Assinatura Renda Viva Pro'
    })
  })

  if (!response.ok) {
    const erro = await response.text()
    console.error('[Asaas] Erro ao criar assinatura:', response.status, erro)
    throw new Error('Erro ao criar assinatura no Asaas')
  }

  return response.json()
}

export async function buscarLinkPagamento(subscriptionId: string): Promise<string | null> {
  const response = await fetch(
    `${env.ASAAS_API_URL}/payments?subscription=${subscriptionId}&limit=1`,
    { headers }
  )

  if (!response.ok) return null

  const data = await response.json()
  return data.data?.[0]?.invoiceUrl || null
}