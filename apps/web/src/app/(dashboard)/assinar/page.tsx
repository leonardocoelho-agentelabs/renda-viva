'use client'
import { useState, useEffect } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function AssinarPage() {
  const [ciclo, setCiclo] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY')
  const [cpf, setCpf] = useState('')
  const [precisaCpf, setPrecisaCpf] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [aguardandoPagamento, setAguardandoPagamento] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    verificarCpf()
  }, [])

  const verificarCpf = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return

    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me`, {
      headers: { 'Authorization': `Bearer ${session.access_token}` }
    })
    const json = await res.json()
    setPrecisaCpf(!json.user?.cpf)
  }

  const iniciarCheckout = async () => {
    setErro('')
    if (precisaCpf && cpf.replace(/\D/g, '').length !== 11) {
      setErro('Informe um CPF válido (11 dígitos)')
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
        body: JSON.stringify({ ciclo, cpf: cpf.replace(/\D/g, '') })
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

        {precisaCpf && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              CPF (necessário para gerar a cobrança)
            </label>
            <input
              type="text"
              value={cpf}
              onChange={e => setCpf(e.target.value)}
              placeholder="000.000.000-00"
              className="w-full border border-gray-300 dark:border-[#1E293B] dark:bg-[#0F172A] rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        )}

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
            disabled={loading}
            className="w-full bg-green-600 text-white rounded-lg py-3 text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
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
