import { FastifyPluginAsync } from 'fastify'
import { supabaseAdmin } from '../../plugins/supabase'
import { enviarMensagemWhatsApp } from '../../services/whatsapp.service'
import { extrairTransacaoDeMensagem } from '../../services/whatsapp-parser.service'
import { normalizarTelefone } from '../../lib/phone'
import { baixarMidiaWhatsApp } from '../../services/evolution-media.service'
import { transcreverAudio } from '../../services/audio-transcription.service'

const whatsappWebhookRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/whatsapp/webhook', async (request, reply) => {
    // [SECURITY C2] Validar header de autenticação do webhook Evolution API
    const webhookSecret = request.headers['apikey'] || request.headers['x-webhook-secret']
    if (webhookSecret !== process.env.EVOLUTION_API_KEY) {
      fastify.log.warn({
        ip: request.ip,
        path: request.url
      }, '[SECURITY] Webhook WhatsApp com chave inválida')
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const body = request.body as any

    // Responder rápido para a Evolution API não reenviar
    reply.status(200).send({ received: true })

    try {
      // Validar evento
      if (body?.event !== 'messages.upsert') return

      const data = body?.data
      if (!data) return

      // Ignorar mensagens enviadas pelo próprio bot
      if (data.key?.fromMe) return

      // Deduplicação via Redis
      const messageId = data.key?.id
      if (messageId) {
        const cacheKey = `whatsapp:processed:${messageId}`
        // Deduplicação é opcional: se o Redis estiver indisponível (ex: réplica
        // read-only), seguimos processando em vez de descartar a mensagem.
        try {
          const jaProcessado = await fastify.redis.get(cacheKey)
          if (jaProcessado) {
            console.log('[WhatsApp Webhook] Mensagem duplicada ignorada:', messageId)
            return
          }
          await fastify.redis.set(cacheKey, '1', 'EX', 300)
        } catch (redisErr) {
          fastify.log.warn({ err: redisErr }, 'Redis indisponível — deduplicação desativada temporariamente')
        }
      }

      const remoteJid = data.key?.remoteJid || ''
      const remoteJidAlt = data.key?.remoteJidAlt || ''

      // Ignorar grupos (verificar sempre no remoteJid original)
      if (remoteJid.endsWith('@g.us')) return

      // Preferir remoteJidAlt (contém o número de telefone real);
      // fallback para remoteJid se remoteJidAlt não existir
      const jidComNumero = remoteJidAlt || remoteJid
      const numeroRemetenteRaw = jidComNumero.replace('@s.whatsapp.net', '').replace('@lid', '').replace(/\D/g, '')
      const numeroRemetenteNormalizado = normalizarTelefone(numeroRemetenteRaw)

      // Extrair texto da mensagem
      let texto: string | null =
        data.message?.conversation ||
        data.message?.extendedTextMessage?.text ||
        null

      let prefixoResposta = ''

      // Se for áudio, transcrever via Whisper
      if (!texto && data.message?.audioMessage) {
        const midia = await baixarMidiaWhatsApp(data.key)

        if (!midia) {
          await enviarMensagemWhatsApp(
            numeroRemetenteRaw,
            '❌ Não consegui processar o áudio. Tente enviar como texto, ex: "Gastei R$30 no almoço"'
          )
          return
        }

        const transcricao = await transcreverAudio(midia.base64, midia.mimetype)

        if (!transcricao) {
          await enviarMensagemWhatsApp(
            numeroRemetenteRaw,
            '❌ Não consegui entender o áudio. Pode tentar de novo ou escrever a mensagem?'
          )
          return
        }

        texto = transcricao
        prefixoResposta = `🎤 _Entendi: "${transcricao}"_\n\n`
      }

      if (!texto) return

      // Buscar contato pelo telefone normalizado
      const { data: contato } = await supabaseAdmin
        .from('whatsapp_contacts')
        .select('user_id, nome')
        .eq('telefone', numeroRemetenteNormalizado)
        .maybeSingle()

      if (!contato) {
        await enviarMensagemWhatsApp(
          numeroRemetenteRaw,
          '👋 Olá! Para registrar transações por aqui, primeiro vincule este número no seu perfil do Renda Viva em rendavivaapp.com/settings'
        )
        return
      }

      // Extrair dados da transação via Claude
      const extraido = await extrairTransacaoDeMensagem(texto)

      if (!extraido.entendido || !extraido.valor || !extraido.descricao_raw) {
        await enviarMensagemWhatsApp(
          numeroRemetenteRaw,
          `🤔 ${extraido.motivo_erro || 'Não entendi essa mensagem.'}\n\nTente algo como: "Gastei R$30 no almoço" ou "Recebi R$500 de pix"`
        )
        return
      }

      const valorComSinal = extraido.tipo === 'receita' ? extraido.valor : -extraido.valor
      const hoje = new Date().toISOString().split('T')[0]

      const { data: transacao, error } = await supabaseAdmin
        .from('transactions')
        .insert({
          user_id: contato.user_id,
          data: hoje,
          valor: valorComSinal,
          descricao_raw: extraido.descricao_raw,
          categoria: extraido.categoria || 'Outros',
          tipo: extraido.tipo === 'receita' ? 'credito' : 'debito',
          status_revisao: 'aprovado',
          score_confianca: 1.0,
          origem: 'whatsapp',
          registrado_por: contato.nome
        })
        .select()
        .single()

      if (error) {
        console.error('[WhatsApp Webhook] Erro ao inserir transação:', error)
        await enviarMensagemWhatsApp(numeroRemetenteRaw, '❌ Erro ao registrar. Tente novamente em alguns instantes.')
        return
      }

      // Recalcular score
      try {
        const { calcularScore } = await import('../score/service')
        await calcularScore(contato.user_id)
      } catch (e) {
        console.error('[WhatsApp Webhook] Erro ao recalcular score:', e)
      }

      const emoji = extraido.tipo === 'receita' ? '💰' : '💸'
      const sinal = extraido.tipo === 'receita' ? '+' : '-'
      const mensagemResposta =
        prefixoResposta +
        `✅ *Registrado!*\n\n` +
        `${emoji} ${extraido.descricao_raw}\n` +
        `${sinal}R$ ${extraido.valor.toFixed(2)} · ${extraido.categoria}\n` +
        `📅 Hoje\n` +
        `👤 Registrado por: ${contato.nome}\n\n` +
        `_Acesse rendavivaapp.com para ver e editar_`

      await enviarMensagemWhatsApp(numeroRemetenteRaw, mensagemResposta)

    } catch (err: any) {
      console.error('[WhatsApp Webhook] Erro:', err.message)
    }
  })
}

export default whatsappWebhookRoutes
