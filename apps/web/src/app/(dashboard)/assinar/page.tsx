'use client'
import { useState, useEffect } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function AssinarPage() {
  const [ciclo, setCiclo] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [cpf, setCpf] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [aguardandoPagamento, setAguardandoPagamento] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    buscarDadosUsuario()
  }, [])

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
        window.location.href = '/dashboard'
      }

      if (tentativas > 60) clearInterval(intervalo) // ~5 minutos
    }, 5000)
  }

  const precoMensal = 97
  const precoAnual = 970

  return (
    <div className="max-w-md w-full">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-[#F8FAFC]">
          Ative sua assinatura
        </h1>
        <p className="text-sm text-gray-500 dark:text-[#94A3B8] mt-2">
          Para usar o Renda Viva, escolha o plano abaixo
        </p>
      </div>

      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-gray-100 dark:border-[#1E293B] shadow-[0_2px_10px_rgba(0,0,0,0.03)] p-6">
        <div className="flex bg-gray-100 dark:bg-[#1E293B] rounded-lg p-1 mb-6">
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
            <span className="text-sm text-gray-400 dark:text-[#94A3B8]">R$</span>
            <span className="text-4xl font-bold text-gray-900 dark:text-[#F8FAFC]">
              {ciclo === 'MONTHLY' ? precoMensal : precoAnual}
            </span>
            <span className="text-sm text-gray-400 dark:text-[#94A3B8]">
              /{ciclo === 'MONTHLY' ? 'mês' : 'ano'}
            </span>
          </div>
          {ciclo === 'YEARLY' && (
            <p className="text-xs text-green-600 mt-1">Equivale a R$80,83/mês</p>
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
            <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-gray-300">
              <div className="w-5 h-5 rounded-full bg-green-50 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check className="w-3 h-3 text-green-600" />
              </div>
              {item}
            </li>
          ))}
        </ul>

        <div className="space-y-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nome completo
            </label>
            <input
              type="text"
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Seu nome completo"
              className="w-full border border-gray-300 dark:border-[#1E293B] dark:bg-[#0F172A] rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              readOnly
              disabled
              placeholder="seu@email.com"
              className="w-full border border-gray-300 dark:border-[#1E293B] dark:bg-[#1E293B] rounded-lg px-3 py-2 text-sm text-gray-500 dark:text-gray-400 placeholder:text-gray-400 cursor-not-allowed opacity-75"
            />
            <p className="text-[10px] text-gray-400 mt-1">Email de login — não pode ser alterado aqui</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              WhatsApp
            </label>
            <input
              type="tel"
              value={telefone}
              onChange={e => setTelefone(formatarTelefone(e.target.value))}
              placeholder="(11) 99999-8888"
              className="w-full border border-gray-300 dark:border-[#1E293B] dark:bg-[#0F172A] rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              CPF (necessário para gerar a cobrança)
            </label>
            <input
              type="text"
              value={cpf}
              onChange={e => setCpf(formatarCpf(e.target.value))}
              placeholder="000.000.000-00"
              maxLength={14}
              className="w-full border border-gray-300 dark:border-[#1E293B] dark:bg-[#0F172A] rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {erro && <p className="text-sm text-red-600 mb-3">{erro}</p>}

        {aguardandoPagamento ? (
          <div className="text-center py-3">
            <Loader2 className="w-5 h-5 text-green-600 animate-spin mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-[#94A3B8]">
              Aguardando confirmação do pagamento...
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Complete o pagamento na aba que abrimos. Esta página atualiza automaticamente.
            </p>
          </div>
        ) : (
          <button
            onClick={iniciarCheckout}
            disabled={loading || !podeAssinar}
            className="w-full bg-green-600 text-white rounded-lg py-3 text-sm font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
