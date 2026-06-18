import { supabaseAdmin } from "../plugins/supabase.js";
import { coletarDadosMercado, type DadosMercado } from "./market.service.js";
import { enviarMensagemWhatsApp } from "./whatsapp.service.js";
import { env } from "../env.js";

export interface Oportunidade {
  titulo: string;
  tipo: string;
  ticker?: string | null;
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
Selecione as 5 melhores oportunidades de investimento para este perfil.
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

FIIs DISPONÍVEIS:
${
  mercado.fiis.length > 0
    ? mercado.fiis
        .slice(0, 5)
        .map(
          (f) =>
            `- ${f.ticker} (${f.nome}): DY ${f.dividendYield}% a.a., P/VP ${f.pvp}, Segmento: ${f.segmento}, Preço: R$ ${f.precoAtual}`
        )
        .join("\n")
    : "Sem dados de FIIs no momento."
}

AÇÕES B3:
${
  mercado.acoes.length > 0
    ? mercado.acoes
        .slice(0, 5)
        .map(
          (a) =>
            `- ${a.ticker} (${a.nome}): DY ${a.dividendYield}%, P/L ${a.pl}, Setor: ${a.setor}, Variação 12m: ${a.variacao12m.toFixed(1)}%`
        )
        .join("\n")
    : "Sem dados de ações no momento."
}

PERFIL DO USUÁRIO:
- Renda mensal: R$ ${Number(perfil?.renda_mensal || 0)}
- Perfil de risco: ${perfil?.perfil_risco || "moderado"}
- Score de saúde financeira: ${perfil?.score_saude || 0}/100
- Saldo disponível este mês: R$ ${saldoMes.toFixed(2)}
- Já investe regularmente: ${jaInveste ? "Sim" : "Não"}

Selecione exatamente 5 oportunidades considerando:
- Perfil conservador: priorizar Tesouro e CDB
- Perfil moderado: misturar Tesouro, FIIs e CDB
- Perfil arrojado: incluir ações e FIIs de crescimento

Retorne JSON com exatamente 5 oportunidades:
[
  {
    "titulo": "Nome do investimento",
    "tipo": "Tesouro Direto | CDB | LCI | LCA | FII | Ação",
    "ticker": "MXRF11 ou PETR4 (se aplicável, senão null)",
    "retornoAnual": "X% a.a.",
    "risco": "baixo | medio | alto",
    "valorMinimo": "R$ X",
    "prazo": "X meses/anos ou indefinido",
    "justificativa": "Por que é ideal agora para este perfil específico",
    "ideal_para": "O que este investimento resolve para o usuário"
  }
]

Priorize: segurança > liquidez > rentabilidade para perfil conservador.
Para moderado: equilibre rentabilidade e liquidez.
Para agressivo: foque em rentabilidade.`;

  let oportunidades: Oportunidade[] = [];
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": env.CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await response.json();
    const responseText = data.content?.[0]?.text || "[]";
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

  const numeros = await getNumerosWhatsAppUsuario(userId);
  if (numeros.length === 0) {
    console.log(`[Radar] Usuário ${userId} não tem números WhatsApp cadastrados`);
    return false;
  }

  const results = await Promise.all(
    numeros.map((numero) =>
      enviarMensagemWhatsApp(numero, mensagem).catch((err) => {
        console.error(`[Radar] Erro ao enviar para ${numero}:`, err);
        return false;
      })
    )
  );

  return results.some((r) => r === true);
}

async function getNumerosWhatsAppUsuario(userId: string): Promise<string[]> {
  const { data: contatos } = await supabaseAdmin
    .from("whatsapp_contacts")
    .select("telefone")
    .eq("user_id", userId);

  if (!contatos || contatos.length === 0) return [];

  return contatos.map((c) => `55${c.telefone}`);
}
