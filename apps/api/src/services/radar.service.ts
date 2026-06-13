import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "../plugins/supabase.js";
import { coletarDadosMercado, type DadosMercado } from "./market.service.js";
import { enviarMensagemWhatsApp } from "./whatsapp.service.js";
import { env } from "../env.js";

const anthropic = new Anthropic({ apiKey: env.CLAUDE_API_KEY });
const NUMERO_TESTE = env.ALERTS_TEST_NUMBER;

export interface Oportunidade {
  titulo: string;
  tipo: string;
  retornoAnual: string;
  risco: "baixo" | "medio" | "alto";
  valorMinimo: string;
  prazo: string;
  justificativa: string;
  ideal_para: string;
}

export interface RadarResultado {
  oportunidades: Oportunidade[];
  mercado: DadosMercado;
}

export async function gerarRadarSemanal(userId: string): Promise<RadarResultado> {
  // 1. Dados de mercado
  const mercado = await coletarDadosMercado();

  // 2. Perfil financeiro
  const { data: perfil } = await supabaseAdmin
    .from("users")
    .select("renda_mensal, perfil_risco, score_saude")
    .eq("id", userId)
    .single();

  // 3. Capacidade de investimento
  const mesAtual = new Date().toISOString().slice(0, 7);
  const inicioMes = `${mesAtual}-01`;
  const { data: transacoes } = await supabaseAdmin
    .from("transactions")
    .select("valor, categoria")
    .eq("user_id", userId)
    .gte("data", inicioMes);

  const saldoMes = (transacoes || []).reduce((s, t) => s + Number(t.valor), 0);
  const jaInveste = (transacoes || []).some((t) => t.categoria === "Investimentos");

  const prompt = `Você é um analista financeiro independente brasileiro.
Selecione as 3 melhores oportunidades de investimento para este perfil.
Retorne SOMENTE JSON válido, sem texto adicional.

DADOS DE MERCADO ATUAIS:
- Selic: ${mercado.selic}% ao ano
- IPCA (inflação): ${mercado.ipca}% ao mês
- CDI: ${mercado.cdi}% ao ano

TÍTULOS DO TESOURO DISPONÍVEIS:
${
    mercado.tesouroDireto.length > 0
      ? mercado.tesouroDireto
          .map(
            (t) =>
              `- ${t.nome}: ${t.taxaAnual}% a.a., venc. ${t.vencimento}, mín. R$ ${t.precoMinimo}`
          )
          .join("\n")
      : "Sem dados do Tesouro no momento."
  }

PERFIL DO USUÁRIO:
- Renda mensal: R$ ${Number(perfil?.renda_mensal || 0)}
- Perfil de risco: ${perfil?.perfil_risco || "moderado"}
- Score de saúde financeira: ${perfil?.score_saude || 0}/100
- Saldo disponível este mês: R$ ${saldoMes.toFixed(2)}
- Já investe regularmente: ${jaInveste ? "Sim" : "Não"}

Retorne JSON com exatamente 3 oportunidades:
[
  {
    "titulo": "Nome do investimento",
    "tipo": "Tesouro Direto | CDB | LCI | LCA | Poupança | Ações | FII",
    "retornoAnual": "13,75% a.a.",
    "risco": "baixo",
    "valorMinimo": "R$ 30,00",
    "prazo": "Curto prazo (até 1 ano)",
    "justificativa": "Por que é ideal agora para este perfil específico",
    "ideal_para": "O que este investimento resolve para o usuário"
  }
]

Priorize: segurança > liquidez > rentabilidade para perfil conservador.
Para moderado: equilibre rentabilidade e liquidez.
Para agressivo: foque em rentabilidade.`;

  let oportunidades: Oportunidade[] = [];
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const first = response.content[0];
    const responseText = first && first.type === "text" ? first.text : "[]";
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) oportunidades = parsed;
    }
  } catch {
    oportunidades = [];
  }

  return { oportunidades, mercado };
}

export async function enviarRadarWhatsApp(userId: string): Promise<boolean> {
  const { oportunidades } = await gerarRadarSemanal(userId);
  if (oportunidades.length === 0) return false;

  const emojisRisco: Record<string, string> = { baixo: "🟢", medio: "🟡", alto: "🔴" };

  let mensagem = `📈 *Renda Viva — Radar de Investimentos*\n`;
  mensagem += `_Curadoria personalizada desta semana_\n\n`;

  oportunidades.forEach((op, i) => {
    const emoji = emojisRisco[op.risco] || "🟡";
    mensagem += `*${i + 1}. ${op.titulo}*\n`;
    mensagem += `${emoji} Risco: ${op.risco} | 📊 ${op.retornoAnual}\n`;
    mensagem += `💰 Mínimo: ${op.valorMinimo} | ⏱️ ${op.prazo}\n`;
    mensagem += `💡 ${op.justificativa}\n\n`;
  });

  mensagem += `_Acesse rendavivaapp.com para mais detalhes_`;

  return enviarMensagemWhatsApp(NUMERO_TESTE, mensagem);
}
