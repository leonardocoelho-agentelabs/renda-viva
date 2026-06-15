import Anthropic from '@anthropic-ai/sdk'
import { env } from '../env'

const anthropic = new Anthropic({ apiKey: env.CLAUDE_API_KEY })

export interface TransacaoExtraida {
  entendido: boolean
  descricao_raw?: string
  valor?: number
  categoria?: string
  tipo?: 'despesa' | 'receita'
  motivo_erro?: string
}

const CATEGORIAS = [
  'Alimentação', 'Transporte', 'Saúde', 'Educação', 'Lazer',
  'Moradia', 'Investimentos', 'Receita', 'Assinaturas', 'Outros'
]

export async function extrairTransacaoDeMensagem(texto: string): Promise<TransacaoExtraida> {
  const prompt = `Você é um assistente que extrai dados de transações financeiras de mensagens
em português brasileiro enviadas via WhatsApp. Retorne SOMENTE um JSON válido, sem texto adicional.

CATEGORIAS DISPONÍVEIS: ${CATEGORIAS.join(', ')}

MENSAGEM DO USUÁRIO:
"${texto}"

Extraia:
- descricao_raw: descrição curta e clara do que foi comprado/recebido (ex: "Fardo de cerveja na adega")
- valor: valor numérico positivo (sempre positivo, sem o sinal)
- categoria: uma das categorias disponíveis (a mais adequada)
- tipo: "despesa" se o usuário GASTOU dinheiro, "receita" se RECEBEU dinheiro
- entendido: true se conseguiu extrair valor e descrição com confiança, false caso contrário
- motivo_erro: se entendido=false, explique brevemente o que faltou (ex: "valor não informado")

Exemplos:
"comprei um fardo de cerveja na adega por R$44,00" →
{"entendido":true,"descricao_raw":"Fardo de cerveja na adega","valor":44.00,"categoria":"Alimentação","tipo":"despesa"}

"recebi 200 reais de pix do meu irmão" →
{"entendido":true,"descricao_raw":"Pix recebido do irmão","valor":200.00,"categoria":"Receita","tipo":"receita"}

"oi" →
{"entendido":false,"motivo_erro":"Mensagem não descreve uma transação financeira"}

Retorne SOMENTE o JSON.`

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }]
  })

  const responseText = response.content[0].type === 'text' ? response.content[0].text : '{}'
  const jsonMatch = responseText.match(/\{[\s\S]*\}/)

  if (!jsonMatch) {
    return { entendido: false, motivo_erro: 'Não foi possível interpretar a mensagem' }
  }

  try {
    return JSON.parse(jsonMatch[0])
  } catch {
    return { entendido: false, motivo_erro: 'Erro ao processar a mensagem' }
  }
}
