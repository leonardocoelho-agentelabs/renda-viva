'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface FamilyMember {
  user_id: string
  nome: string
  score: number
  receitas: number
  gastos: number
  saldo: number
  role: string
}

interface FamilyDashboard {
  family: { id: string; nome: string }
  resumo: {
    total_membros: number
    receitas_total: number
    gastos_total: number
    saldo_total: number
    score_medio: number
  }
  membros: FamilyMember[]
  transacoes_recentes: any[]
}

export default function FamiliaPage() {
  const supabase = createClient()
  const [familyData, setFamilyData] = useState<any>(null)
  const [dashboard, setDashboard] = useState<FamilyDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteForm, setInviteForm] = useState({ nome: '', email: '', whatsapp: '' })
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [copySuccess, setCopySuccess] = useState(false)
  const [inviteLink, setInviteLink] = useState('')

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

  const getToken = async () => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token
  }

  useEffect(() => {
    loadFamily()
  }, [])

  const loadFamily = async () => {
    setLoading(true)
    try {
      const token = await getToken()
      const [familyRes, dashRes] = await Promise.all([
        fetch(`${API}/family`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/family/dashboard`, { headers: { Authorization: `Bearer ${token}` } })
      ])
      if (familyRes.ok) setFamilyData(await familyRes.json())
      if (dashRes.ok) setDashboard(await dashRes.json())
    } catch {}
    setLoading(false)
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviteError('')
    setInviteLoading(true)
    try {
      const token = await getToken()
      const isFirstInvite = !familyData?.family

      const res = await fetch(`${API}/family${isFirstInvite ? '' : '/invite'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          nome_membro: inviteForm.nome,
          email_membro: inviteForm.email,
          whatsapp_membro: inviteForm.whatsapp
        })
      })

      const data = await res.json()
      if (!res.ok) { setInviteError(data.error); return }

      const link = `${window.location.origin}/register?token=${data.member?.token_convite || data.token}`
      setInviteLink(link)
      setInviteSuccess(true)
      loadFamily()
    } catch {
      setInviteError('Erro ao enviar convite. Tente novamente.')
    } finally {
      setInviteLoading(false)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Tem certeza que deseja remover este membro da família?')) return
    const token = await getToken()
    await fetch(`${API}/family/members/${memberId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
    loadFamily()
  }

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink)
    setCopySuccess(true)
    setTimeout(() => setCopySuccess(false), 2000)
  }

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

  const card = { background: '#fff', border: '1px solid rgba(27,67,50,0.08)', borderRadius: '16px', padding: '24px' }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid #D8F3DC', borderTop: '3px solid #2D6A4F', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }}/>
          <p style={{ color: '#5A6B62', fontFamily: 'Inter, sans-serif', fontSize: '14px' }}>Carregando família...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '32px', maxWidth: '900px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '28px', color: '#1B4332', margin: 0 }}>
            {dashboard?.family?.nome || 'Modo Família'}
          </h1>
          <p style={{ color: '#5A6B62', fontSize: '14px', margin: '6px 0 0' }}>
            Visão financeira consolidada da sua família
          </p>
        </div>
        {familyData?.role === 'owner' && !familyData?.family?.family_members?.some((m: any) => m.status === 'ativo' || m.status === 'pendente') && (
          <button
            onClick={() => setShowInviteForm(true)}
            style={{ padding: '10px 20px', background: '#2D6A4F', color: '#fff', border: 'none', borderRadius: '10px', fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
          >
            + Convidar Membro
          </button>
        )}
      </div>

      {/* Sem família ainda */}
      {!familyData?.family && !showInviteForm && (
        <div style={{ ...card, textAlign: 'center', padding: '64px 40px' }}>
          <div style={{ width: '72px', height: '72px', background: '#D8F3DC', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2D6A4F" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87"/>
              <path d="M16 3.13a4 4 0 010 7.75"/>
            </svg>
          </div>
          <h2 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '22px', color: '#1B4332', marginBottom: '12px', marginTop: 0 }}>
            Crie sua família
          </h2>
          <p style={{ color: '#5A6B62', fontSize: '15px', lineHeight: 1.7, maxWidth: '400px', margin: '0 auto 32px' }}>
            Convide 1 membro para compartilhar a visão financeira da família. Cada um adiciona suas próprias transações e todos veem o consolidado.
          </p>
          <button
            onClick={() => setShowInviteForm(true)}
            style={{ padding: '13px 32px', background: '#2D6A4F', color: '#fff', border: 'none', borderRadius: '10px', fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '15px', cursor: 'pointer' }}
          >
            Convidar membro da família
          </button>
        </div>
      )}

      {/* Formulário de convite */}
      {showInviteForm && !inviteSuccess && (
        <div style={{ ...card, marginBottom: '24px' }}>
          <h3 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '18px', color: '#1B4332', marginBottom: '6px', marginTop: 0 }}>
            Convidar membro
          </h3>
          <p style={{ color: '#5A6B62', fontSize: '13px', marginBottom: '24px', marginTop: 0 }}>
            A pessoa receberá um link para criar a conta no Renda Viva sem precisar pagar assinatura.
          </p>
          <form onSubmit={handleInvite}>
            {inviteError && (
              <div style={{ padding: '12px 14px', background: '#FEF2F0', border: '1px solid #F5C6C0', borderRadius: '10px', color: '#C44B35', fontSize: '13px', marginBottom: '16px' }}>
                {inviteError}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 500, color: '#1B4332', display: 'block', marginBottom: '6px' }}>Nome Completo</label>
                <input type="text" placeholder="Maria Silva" required value={inviteForm.nome} onChange={e => setInviteForm(p => ({ ...p, nome: e.target.value }))}
                  style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #D8F3DC', borderRadius: '10px', fontSize: '14px', color: '#1B2A22', outline: 'none', boxSizing: 'border-box' as const }}/>
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 500, color: '#1B4332', display: 'block', marginBottom: '6px' }}>WhatsApp</label>
                <input type="tel" placeholder="+55 11 9XXXX-XXXX" required value={inviteForm.whatsapp} onChange={e => setInviteForm(p => ({ ...p, whatsapp: e.target.value }))}
                  style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #D8F3DC', borderRadius: '10px', fontSize: '14px', color: '#1B2A22', outline: 'none', boxSizing: 'border-box' as const }}/>
              </div>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: '#1B4332', display: 'block', marginBottom: '6px' }}>E-mail</label>
              <input type="email" placeholder="membro@email.com" required value={inviteForm.email} onChange={e => setInviteForm(p => ({ ...p, email: e.target.value }))}
                style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #D8F3DC', borderRadius: '10px', fontSize: '14px', color: '#1B2A22', outline: 'none', boxSizing: 'border-box' as const }}/>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="submit" disabled={inviteLoading}
                style={{ flex: 1, padding: '12px', background: inviteLoading ? '#74C69D' : '#2D6A4F', color: '#fff', border: 'none', borderRadius: '10px', fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '14px', cursor: inviteLoading ? 'not-allowed' : 'pointer' }}>
                {inviteLoading ? 'Gerando convite...' : 'Gerar link de convite'}
              </button>
              <button type="button" onClick={() => setShowInviteForm(false)}
                style={{ padding: '12px 20px', background: 'transparent', color: '#5A6B62', border: '1.5px solid #D8F3DC', borderRadius: '10px', fontSize: '14px', cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Link gerado com sucesso */}
      {inviteSuccess && (
        <div style={{ ...card, marginBottom: '24px', borderColor: '#95D5B2' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#D8F3DC', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2D6A4F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div>
              <p style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '16px', color: '#1B4332', margin: 0 }}>Convite gerado!</p>
              <p style={{ fontSize: '13px', color: '#5A6B62', margin: '2px 0 0' }}>Compartilhe o link abaixo com o membro da família</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ flex: 1, padding: '10px 14px', background: '#F5F8F6', border: '1.5px solid #D8F3DC', borderRadius: '10px', fontSize: '13px', color: '#1B4332', wordBreak: 'break-all' as const }}>
              {inviteLink}
            </div>
            <button onClick={copyLink}
              style={{ padding: '10px 16px', background: copySuccess ? '#52B788' : '#2D6A4F', color: '#fff', border: 'none', borderRadius: '10px', fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
              {copySuccess ? '✓ Copiado!' : 'Copiar link'}
            </button>
          </div>
        </div>
      )}

      {/* Dashboard consolidado */}
      {dashboard && (
        <>
          {/* Cards de resumo */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
            {[
              { label: 'Membros', value: String(dashboard.resumo.total_membros), color: '#2D6A4F', icon: '👨‍👩‍👧' },
              { label: 'Receitas do mês', value: fmt(dashboard.resumo.receitas_total), color: '#2D6A4F', icon: '↑' },
              { label: 'Gastos do mês', value: fmt(dashboard.resumo.gastos_total), color: '#C44B35', icon: '↓' },
              { label: 'Saldo familiar', value: fmt(dashboard.resumo.saldo_total), color: dashboard.resumo.saldo_total >= 0 ? '#2D6A4F' : '#C44B35', icon: '=' },
            ].map((item, i) => (
              <div key={i} style={card}>
                <p style={{ fontSize: '12px', color: '#5A6B62', margin: '0 0 8px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>{item.icon} {item.label}</p>
                <p style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '22px', color: item.color, margin: 0 }}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* Cards dos membros */}
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '18px', color: '#1B4332', marginBottom: '16px', marginTop: 0 }}>
              Membros da família
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {dashboard.membros.map((membro) => (
                <div key={membro.user_id} style={{ ...card, position: 'relative' as const }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#D8F3DC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '16px', color: '#2D6A4F' }}>
                        {membro.nome?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '15px', color: '#1B4332', margin: 0 }}>{membro.nome}</p>
                        <span style={{ fontSize: '11px', color: membro.role === 'owner' ? '#2D6A4F' : '#5A6B62', background: membro.role === 'owner' ? '#D8F3DC' : '#F0F4F2', padding: '2px 8px', borderRadius: '100px', fontWeight: 500 }}>
                          {membro.role === 'owner' ? 'Titular' : 'Membro'}
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' as const }}>
                      <p style={{ fontSize: '11px', color: '#5A6B62', margin: '0 0 2px' }}>Score</p>
                      <p style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '20px', color: '#2D6A4F', margin: 0 }}>{membro.score || 0}</p>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <div>
                      <p style={{ fontSize: '11px', color: '#5A6B62', margin: '0 0 4px' }}>Receitas</p>
                      <p style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '14px', color: '#2D6A4F', margin: 0 }}>{fmt(membro.receitas)}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: '11px', color: '#5A6B62', margin: '0 0 4px' }}>Gastos</p>
                      <p style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '14px', color: '#C44B35', margin: 0 }}>{fmt(membro.gastos)}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: '11px', color: '#5A6B62', margin: '0 0 4px' }}>Saldo</p>
                      <p style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '14px', color: membro.saldo >= 0 ? '#2D6A4F' : '#C44B35', margin: 0 }}>{fmt(membro.saldo)}</p>
                    </div>
                  </div>
                </div>
              ))}

              {/* Card de membro pendente */}
              {familyData?.family?.family_members?.filter((m: any) => m.status === 'pendente').map((pending: any) => (
                <div key={pending.id} style={{ ...card, border: '1.5px dashed #95D5B2', background: '#FAFFFE' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#D8F3DC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>⏳</div>
                      <div>
                        <p style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '15px', color: '#1B4332', margin: 0 }}>{pending.nome_membro}</p>
                        <span style={{ fontSize: '11px', color: '#74C69D', background: '#D8F3DC', padding: '2px 8px', borderRadius: '100px', fontWeight: 500 }}>Convite pendente</span>
                      </div>
                    </div>
                    <button onClick={() => handleRemoveMember(pending.id)}
                      style={{ padding: '6px 12px', background: 'transparent', color: '#C44B35', border: '1px solid #F5C6C0', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>
                      Cancelar
                    </button>
                  </div>
                  <p style={{ fontSize: '13px', color: '#5A6B62', margin: 0 }}>
                    {pending.email_convidado} · {pending.whatsapp_membro}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Transações recentes da família */}
          {dashboard.transacoes_recentes.length > 0 && (
            <div style={card}>
              <h3 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '16px', color: '#1B4332', marginBottom: '16px', marginTop: 0 }}>
                Transações recentes da família
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px' }}>
                {dashboard.transacoes_recentes.slice(0, 10).map((tx: any, i: number) => {
                  const membro = dashboard.membros.find(m => m.user_id === tx.user_id)
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#F5F8F6', borderRadius: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#D8F3DC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#2D6A4F', flexShrink: 0 }}>
                          {membro?.nome?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div>
                          <p style={{ fontSize: '13px', fontWeight: 500, color: '#1B2A22', margin: 0 }}>{tx.descricao_raw}</p>
                          <p style={{ fontSize: '11px', color: '#5A6B62', margin: '2px 0 0' }}>{tx.categoria} · {membro?.nome}</p>
                        </div>
                      </div>
                      <span style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '14px', color: tx.tipo === 'credito' ? '#2D6A4F' : '#C44B35' }}>
                        {tx.tipo === 'credito' ? '+' : '-'}{fmt(Math.abs(Number(tx.valor)))}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
