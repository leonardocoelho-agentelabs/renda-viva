import crypto from 'crypto'
import { env } from '../env'

function hashSHA256(value: string): string {
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
}

interface PurchaseEventParams {
  email: string
  valor: number
  eventId: string
  fbp?: string
  fbc?: string
  clientIp?: string
  userAgent?: string
}

export async function enviarEventoPurchaseMeta(params: PurchaseEventParams) {
  if (!env.META_PIXEL_ID || !env.META_CONVERSIONS_API_TOKEN) {
    console.warn('[Meta CAPI] Pixel ID ou Token não configurado — evento não enviado')
    return
  }

  const payload = {
    data: [
      {
        event_name: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        event_id: params.eventId,
        action_source: 'website',
        event_source_url: 'https://rendavivaapp.com/assinar',
        user_data: {
          em: [hashSHA256(params.email)],
          ...(params.fbp ? { fbp: params.fbp } : {}),
          ...(params.fbc ? { fbc: params.fbc } : {}),
          ...(params.clientIp ? { client_ip_address: params.clientIp } : {}),
          ...(params.userAgent ? { client_user_agent: params.userAgent } : {}),
        },
        custom_data: {
          currency: 'BRL',
          value: params.valor,
        },
      },
    ],
  }

  try {
    const url = `https://graph.facebook.com/v21.0/${env.META_PIXEL_ID}/events?access_token=${env.META_CONVERSIONS_API_TOKEN}`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const erro = await response.text()
      console.error('[Meta CAPI] Erro ao enviar evento Purchase:', response.status, erro)
      return
    }

    const data = await response.json()
    console.log('[Meta CAPI] Evento Purchase enviado com sucesso:', data)
  } catch (err: any) {
    console.error('[Meta CAPI] Erro ao enviar evento:', err.message)
  }
}
