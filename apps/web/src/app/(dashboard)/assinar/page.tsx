'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, LogOut, Calendar, CreditCard, Clock, ShieldCheck, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { trackEvent } from '@/lib/meta-pixel'

const handleLogout = async () => {
  const supabase = createClient()
  await supabase.auth.signOut()
  window.location.href = '/login'
}

export default function AssinarPage() {
  const [ciclo, setCiclo] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [cpf, setCpf] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [aguardandoPagamento, setAguardandoPagamento] = useState(false)
  const [temAcesso, setTemAcesso] = useState<boolean | null>(null)
  const [subscription, setSubscription] = useState<any>(null)
  const [acessoLiberado, setAcessoLiberado] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const [textoCancelamento, setTextoCancelamento] = useState('')
  const [cancelado, setCancelado] = useState(false)
  const [erroCancelamento, setErroCancelamento] = useState('')
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    verificarAcesso()
    buscarDadosUsuario()
  }, [])

  const verificarAcesso = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return

    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/subscriptions/me`, {
      headers: { 'Authorization': `Bearer ${session.access_token}` }
    })
    const json = await res.json()

    setTemAcesso(json.temAcesso)
    setSubscription(json.subscription || null)
    setAcessoLiberado(!!json.acessoLiberado)

    if (!json.temAcesso) {
      // Sem acesso: mostrar formulário de assinatura → disparar InitiateCheckout
      trackEvent('InitiateCheckout', {
        content_name: 'renda_viva_assinatura',
        value: ciclo === 'MONTHLY' ? 97 : 970,
        currency: 'BRL',
      })
    }
    // Com acesso: NÃO redirecionar — mostrar painel de gerenciamento
  }

  const confirmarCancelamento = async () => {
    if (textoCancelamento !== 'CANCELAR') return
    setCancelando(true)
    setErroCancelamento('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/subscriptions/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ confirmacao: 'CANCELAR' }),
      })
      if (!res.ok) {
        const json = await res.json()
        setErroCancelamento(json.error || 'Erro ao cancelar assinatura.')
        return
      }
      setCancelado(true)
      setSubscription((prev: any) => prev ? { ...prev, status: 'canceled' } : prev)
    } catch {
      setErroCancelamento('Erro ao cancelar. Tente novamente.')
    } finally {
      setCancelando(false)
    }
  }

  const buscarDadosUsuario = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return

    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me`, {
      headers: { 'Authorization': `Bearer ${session.access_token}` }
    })
    const json = await res.json()
    if (json.user) {
      setNome(json.user.full_name || '')
      setEmail(json.user.email || '')
      setTelefone(json.user.telefone || '')
      setCpf(json.user.cpf || '')
    }
  }

  const formatarCpf = (valor: string) => {
    const digits = valor.replace(/\D/g, '')
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`
  }

  const formatarTelefone = (valor: string) => {
    const digits = valor.replace(/\D/g, '')
    if (digits.length <= 2) return digits
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`
  }

  const cpfDigits = cpf.replace(/\D/g, '')
  const telefoneDigits = telefone.replace(/\D/g, '')
  const podeAssinar = nome.trim().length > 0 && cpfDigits.length === 11 && telefoneDigits.length >= 10

  const iniciarCheckout = async () => {
    setErro('')
    if (!podeAssinar) {
      if (!nome.trim()) {
        setErro('Informe seu nome completo')
        return
      }
      if (cpfDigits.length !== 11) {
        setErro('Informe um CPF válido (11 dígitos)')
        return
      }
      if (telefoneDigits.length < 10) {
        setErro('Informe um WhatsApp válido')
        return
      }
      return
    }

    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/subscriptions/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          ciclo,
          cpf: cpfDigits,
          nome: nome.trim(),
          telefone: telefoneDigits
        })
      })

      if (!res.ok) {
        const json = await res.json()
        setErro(json.error || 'Erro ao iniciar assinatura')
        setLoading(false)
        return
      }

      const json = await res.json()
      if (json.invoiceUrl) {
        setAguardandoPagamento(true)
        window.open(json.invoiceUrl, '_blank')
        iniciarPolling()
      }
    } catch (e) {
      setErro('Erro ao processar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const iniciarPolling = () => {
    let tentativas = 0
    const intervalo = setInterval(async () => {
      tentativas++
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/subscriptions/me`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })
      const json = await res.json()

      if (json.subscription?.status === 'active' || json.subscription?.status === 'overdue') {
        clearInterval(intervalo)
        // Purchase (client-side) — deduplicado com o server-side via event_id
        trackEvent(
          'Purchase',
          { value: ciclo === 'MONTHLY' ? 97 : 970, currency: 'BRL' },
          json.subscription.asaas_subscription_id
        )
        window.location.href = '/dashboard'
      }

      if (tentativas > 60) clearInterval(intervalo) // ~5 minutos
    }, 5000)
  }

  const precoMensal = 97
  const precoAnual = 970

  const calcularDiasRestantes = (dataISO: string | null): number | null => {
    if (!dataISO) return null
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const vencimento = new Date(dataISO)
    vencimento.setHours(0, 0, 0, 0)
    const diff = vencimento.getTime() - hoje.getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  const formatarData = (dataISO: string | null): string => {
    if (!dataISO) return '—'
    const d = new Date(dataISO)
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const statusLabel: Record<string, string> = {
    active: 'Ativa',
    overdue: 'Em atraso',
    canceled: 'Cancelada',
    pending: 'Pendente',
  }

  const statusColor: Record<string, string> = {
    active: 'text-green-600 dark:text-rv-vivid bg-green-50 dark:bg-rv-vivid/10',
    overdue: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-400/10',
    canceled: 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-400/10',
    pending: 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700',
  }

  // Estado de carregamento inicial
  if (temAcesso === null) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-6 h-6 text-rv-green dark:text-rv-vivid animate-spin" />
      </div>
    )
  }

  // ─────────────────────────────────────────
  // PAINEL DE GERENCIAMENTO (usuário já assinou)
  // ─────────────────────────────────────────
  if (temAcesso) {
    const diasRestantes = calcularDiasRestantes(subscription?.proxima_cobranca)
    const status = subscription?.status || 'active'
    const valor = subscription?.valor ?? 97
    const cicloSub = subscription?.ciclo || 'MONTHLY'
    const proximaCobranca = subscription?.proxima_cobranca

    return (
      <div className="max-w-md w-full relative">
        {/* Botão sair */}
        <div className="absolute top-4 right-4">
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-gray-400
                       hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair
          </button>
        </div>

        {/* Título */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-rv-mint dark:bg-rv-vivid/15
                          flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-7 h-7 text-rv-green dark:text-rv-vivid" />
          </div>
          <h1 className="font-[var(--font-poppins)] font-bold text-2xl
                         text-rv-ink dark:text-[#F0F0F0]">
            Minha assinatura
          </h1>
          <p className="text-rv-muted dark:text-[#8A8A8A] mt-2 text-sm">
            Gerencie seu plano no Renda Viva
          </p>
        </div>

        {/* Card principal */}
        <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border
                        border-gray-100 dark:border-white/8 shadow-sm p-6 space-y-5">

          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-rv-ink dark:text-[#F0F0F0]">
              Status
            </span>
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusColor[status] || statusColor.pending}`}>
              {statusLabel[status] || status}
            </span>
          </div>

          <div className="border-t border-gray-100 dark:border-white/6" />

          {/* Plano e valor */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-rv-ink dark:text-[#F0F0F0]">
              <CreditCard className="w-4 h-4 text-rv-muted dark:text-[#8A8A8A]" />
              <span>Plano {cicloSub === 'MONTHLY' ? 'Mensal' : 'Anual'}</span>
            </div>
            <span className="font-[var(--font-poppins)] font-bold text-lg
                             text-rv-ink dark:text-[#F0F0F0]">
              R$ {Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              <span className="text-xs font-normal text-rv-muted dark:text-[#8A8A8A] ml-1">
                /{cicloSub === 'MONTHLY' ? 'mês' : 'ano'}
              </span>
            </span>
          </div>

          <div className="border-t border-gray-100 dark:border-white/6" />

          {/* Próxima cobrança */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-rv-ink dark:text-[#F0F0F0]">
              <Calendar className="w-4 h-4 text-rv-muted dark:text-[#8A8A8A]" />
              <span>Próxima cobrança</span>
            </div>
            <span className="text-sm font-medium text-rv-ink dark:text-[#F0F0F0]">
              {formatarData(proximaCobranca)}
            </span>
          </div>

          <div className="border-t border-gray-100 dark:border-white/6" />

          {/* Dias restantes */}
          {diasRestantes !== null && status !== 'canceled' && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-rv-ink dark:text-[#F0F0F0]">
                  <Clock className="w-4 h-4 text-rv-muted dark:text-[#8A8A8A]" />
                  <span>Dias restantes</span>
                </div>
                <span className={`text-sm font-semibold ${
                  diasRestantes <= 5
                    ? 'text-red-500 dark:text-red-400'
                    : diasRestantes <= 15
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-rv-green dark:text-rv-vivid'
                }`}>
                  {diasRestantes > 0 ? `${diasRestantes} dias` : 'Vence hoje'}
                </span>
              </div>
              <div className="border-t border-gray-100 dark:border-white/6" />
            </>
          )}

          {/* Acesso liberado manualmente */}
          {acessoLiberado && (
            <p className="text-xs text-rv-muted dark:text-[#8A8A8A] text-center">
              ✨ Acesso liberado pela equipe Renda Viva
            </p>
          )}

          {/* Botão voltar ao dashboard */}
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full bg-rv-green dark:bg-rv-vivid text-white rounded-xl
                       py-3 text-sm font-semibold hover:bg-rv-forest
                       dark:hover:bg-rv-vivid/90 transition-colors"
          >
            Voltar ao Dashboard
          </button>

          {/* Cancelamento — só mostrar se não estiver cancelado */}
          {status !== 'canceled' && !acessoLiberado && (
            <>
              <div className="border-t border-gray-100 dark:border-white/6 pt-2">
                {!cancelado ? (
                  <>
                    <p className="text-xs text-rv-muted dark:text-[#8A8A8A] mb-3 text-center">
                      Para cancelar sua assinatura, digite <strong>CANCELAR</strong> abaixo
                    </p>
                    <input
                      type="text"
                      value={textoCancelamento}
                      onChange={e => setTextoCancelamento(e.target.value.toUpperCase())}
                      placeholder="Digite CANCELAR para confirmar"
                      className="w-full border border-gray-200 dark:border-white/10
                                 dark:bg-[#2A2A2A] rounded-xl px-3 py-2 text-sm
                                 text-rv-ink dark:text-[#F0F0F0]
                                 placeholder:text-rv-muted/60 dark:placeholder:text-[#8A8A8A]
                                 focus:outline-none focus:ring-2 focus:ring-red-500/30
                                 mb-2"
                    />
                    {erroCancelamento && (
                      <p className="text-xs text-red-500 mb-2">{erroCancelamento}</p>
                    )}
                    <button
                      onClick={confirmarCancelamento}
                      disabled={textoCancelamento !== 'CANCELAR' || cancelando}
                      className="w-full border border-red-200 dark:border-red-500/30
                                 text-red-500 dark:text-red-400 rounded-xl py-2.5
                                 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-500/10
                                 disabled:opacity-40 disabled:cursor-not-allowed
                                 transition-colors flex items-center justify-center gap-2"
                    >
                      {cancelando ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <AlertTriangle className="w-4 h-4" />
                      )}
                      {cancelando ? 'Cancelando...' : 'Cancelar assinatura'}
                    </button>
                  </>
                ) : (
                  <div className="text-center py-2">
                    <p className="text-sm text-rv-muted dark:text-[#8A8A8A]">
                      Assinatura cancelada. Você ainda tem acesso até o fim do período pago.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <p className="text-xs text-gray-400 text-center mt-4">
          Pagamento processado via Asaas · Dúvidas? Fale conosco
        </p>
      </div>
    )
  }

  // ─────────────────────────────────────────
  // FORMULÁRIO DE NOVA ASSINATURA (sem acesso)
  // ─────────────────────────────────────────
  return (
    <div className="max-w-md w-full relative">
      <div className="absolute top-4 right-4">
        <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          <LogOut className="w-3.5 h-3.5" />
          Sair
        </button>
      </div>

      <div className="text-center mb-8">
        <h1 className="font-[var(--font-poppins)] font-bold text-2xl text-rv-ink dark:text-[#F0F0F0]">
          Ative sua assinatura
        </h1>
        <p className="text-rv-muted dark:text-[#8A8A8A] mt-2">
          Para usar o Renda Viva, escolha o plano abaixo
        </p>
      </div>

      <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-white/8 shadow-sm p-6">
        <div className="flex bg-rv-mint/50 dark:bg-[#2A2A2A] rounded-lg p-1 mb-6">
          <button
            onClick={() => setCiclo('MONTHLY')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              ciclo === 'MONTHLY' ? 'bg-white dark:bg-[#0F172A] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'
            }`}
          >
            Mensal
          </button>
          <button
            onClick={() => setCiclo('YEARLY')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors relative ${
              ciclo === 'YEARLY' ? 'bg-white dark:bg-[#0F172A] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'
            }`}
          >
            Anual
            <span className="absolute -top-2 -right-1 bg-green-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">
              -17%
            </span>
          </button>
        </div>

        <div className="text-center mb-6">
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-sm text-[#8A8A8A]">R$</span>
            <span className="font-[var(--font-poppins)] font-bold text-4xl text-rv-ink dark:text-[#F0F0F0]">
              {ciclo === 'MONTHLY' ? precoMensal : precoAnual}
            </span>
            <span className="text-sm text-[#8A8A8A]">
              /{ciclo === 'MONTHLY' ? 'mês' : 'ano'}
            </span>
          </div>
          {ciclo === 'YEARLY' && (
            <p className="text-xs text-rv-green dark:text-rv-vivid mt-1">Equivale a R$80,83/mês</p>
          )}
        </div>

        <ul className="space-y-2.5 mb-6">
          {[
            'Categorização automática com IA',
            'Registro via WhatsApp (texto e áudio)',
            'Múltiplos números — gestão familiar',
            'Insights e relatórios inteligentes',
            'Orçamento adaptativo',
            'Radar de investimentos semanal',
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-rv-ink dark:text-[#F0F0F0]">
              <div className="w-5 h-5 rounded-full bg-rv-mint dark:bg-rv-vivid/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check className="w-3 h-3 text-rv-green dark:text-rv-vivid" />
              </div>
              {item}
            </li>
          ))}
        </ul>

        <div className="space-y-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-rv-ink dark:text-[#F0F0F0] mb-1">
              Nome completo
            </label>
            <input
              type="text"
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Seu nome completo"
              className="w-full border border-white/10 dark:border-white/10 dark:bg-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-rv-ink dark:text-[#F0F0F0] placeholder:text-rv-muted/70 dark:placeholder:text-[#8A8A8A] focus:outline-none focus:ring-2 focus:ring-rv-green"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-rv-ink dark:text-[#F0F0F0] mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              readOnly
              disabled
              placeholder="seu@email.com"
              className="w-full border border-white/10 dark:border-white/10 dark:bg-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-[#8A8A8A] placeholder:text-rv-muted/70 dark:placeholder:text-[#8A8A8A] cursor-not-allowed opacity-75"
            />
            <p className="text-[10px] text-[#8A8A8A] mt-1">Email de login — não pode ser alterado aqui</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-rv-ink dark:text-[#F0F0F0] mb-1">
              WhatsApp
            </label>
            <input
              type="tel"
              value={telefone}
              onChange={e => setTelefone(formatarTelefone(e.target.value))}
              placeholder="(11) 99999-8888"
              className="w-full border border-white/10 dark:border-white/10 dark:bg-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-rv-ink dark:text-[#F0F0F0] placeholder:text-rv-muted/70 dark:placeholder:text-[#8A8A8A] focus:outline-none focus:ring-2 focus:ring-rv-green"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-rv-ink dark:text-[#F0F0F0] mb-1">
              CPF (necessário para gerar a cobrança)
            </label>
            <input
              type="text"
              value={cpf}
              onChange={e => setCpf(formatarCpf(e.target.value))}
              placeholder="000.000.000-00"
              maxLength={14}
              className="w-full border border-white/10 dark:border-white/10 dark:bg-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-rv-ink dark:text-[#F0F0F0] placeholder:text-rv-muted/70 dark:placeholder:text-[#8A8A8A] focus:outline-none focus:ring-2 focus:ring-rv-green"
            />
          </div>
        </div>

        {erro && <p className="text-sm text-red-500 mb-3">{erro}</p>}

        {aguardandoPagamento ? (
          <div className="text-center py-3">
            <Loader2 className="w-5 h-5 text-rv-green dark:text-rv-vivid animate-spin mx-auto mb-2" />
            <p className="text-sm text-[#8A8A8A]">
              Aguardando confirmação do pagamento...
            </p>
            <p className="text-xs text-[#8A8A8A] mt-1">
              Complete o pagamento na aba que abrimos. Esta página atualiza automaticamente.
            </p>
          </div>
        ) : (
          <button
            onClick={iniciarCheckout}
            disabled={loading || !podeAssinar}
            className="w-full bg-rv-green dark:bg-rv-vivid text-white rounded-lg py-3 text-sm font-semibold hover:bg-rv-forest dark:hover:bg-rv-vivid/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Processando...' : 'Assinar agora'}
          </button>
        )}
      </div>

      <p className="text-xs text-gray-400 text-center mt-4">
        Pagamento processado via Asaas. Cancele quando quiser.
      </p>
    </div>
  )
}
