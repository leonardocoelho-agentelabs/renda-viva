import Anthropic from "@anthropic-ai/sdk";
import { env } from "../env.js";

export interface ParsedTransaction {
  data: string;
  valor: number;
  descricao_raw: string;
  tipo: "debito" | "credito" | "pix" | "transferencia";
}

export interface UserCorrection {
  descricao_raw: string;
  categoria_correta: string;
  subcategoria_correta: string | null;
}

export interface CategorizedTransaction {
  descricao_raw: string;
  categoria: string;
  subcategoria: string | null;
  score: number;
  is_recorrente: boolean;
}

const CATEGORIAS_VALIDAS = [
  "Alimentação",
  "Transporte",
  "Saúde",
  "Moradia",
  "Lazer",
  "Educação",
  "Investimentos",
  "Receita",
  "Outros",
];

const SYSTEM_PROMPT = `Você é um classificador financeiro pessoal brasileiro. Analise as transações e retorne SOMENTE um JSON válido, sem texto adicional.

Categorias válidas: ${CATEGORIAS_VALIDAS.join(", ")}

Retorne um array JSON no formato:
[{
  "descricao_raw": "descrição original",
  "categoria": "categoria mais apropriada",
  "subcategoria": "subcategoria específica",
  "score": 0.95,
  "is_recorrente": true/false
}]`;

export class ClaudeService {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: env.CLAUDE_API_KEY,
    });
  }

  async categorizarTransacoes(
    transacoes: ParsedTransaction[],
    correcoesUsuario: UserCorrection[] = []
  ): Promise<CategorizedTransaction[]> {
    if (transacoes.length === 0) return [];

    // Limitar a 20 por vez
    const batch = transacoes.slice(0, 20);

    // Construir few-shot examples das correções do usuário
    let fewShotExamples = "";
    if (correcoesUsuario.length > 0) {
      const examples = correcoesUsuario.slice(0, 5).map((c) => {
        return `Entrada: "${c.descricao_raw}" -> Categoria: ${c.categoria_correta}${c.subcategoria_correta ? `, Subcategoria: ${c.subcategoria_correta}` : ""}`;
      });
      fewShotExamples = `\n\nExemplos de categorização do usuário:\n${examples.join("\n")}`;
    }

    // Construir prompt do usuário
    const transacoesTexto = batch
      .map((t) => {
        const tipoLabel = t.tipo === "credito" ? "CRÉDITO" : "DÉBITO";
        return `[${tipoLabel}] ${t.data} - ${t.descricao_raw} - R$ ${t.valor.toFixed(2).replace(".", ",")}`;
      })
      .join("\n");

    const userPrompt = `Analise estas ${batch.length} transações e categorize cada uma:${fewShotExamples}

Transações:
${transacoesTexto}

Retorne SOMENTE o JSON, sem explicações.`;

    let lastError: Error | null = null;

    // Retry 3 vezes
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await this.client.messages.create(
          {
            model: "claude-haiku-4-5",
            max_tokens: 2000,
            system: SYSTEM_PROMPT,
            messages: [
              {
                role: "user",
                content: userPrompt,
              },
            ],
          },
          {
            // Timeout explícito para não travar o worker se a API não responder
            timeout: 30000,
          }
        );

        const content = response.content[0];
        if (content.type !== "text") {
          throw new Error("Resposta inesperada do Claude");
        }

        // Extrair JSON da resposta
        const text = content.text.trim();
        const jsonMatch = text.match(/\[[\s\S]*\]/);

        if (!jsonMatch) {
          throw new Error("JSON não encontrado na resposta");
        }

        const parsed = JSON.parse(jsonMatch[0]) as CategorizedTransaction[];

        // Log: verificar se few-shot influenciou na categorização
        for (const cat of parsed) {
          const fewShotMatch = correcoesUsuario.find(
            (c) =>
              c.descricao_raw.toLowerCase() === cat.descricao_raw.toLowerCase() &&
              c.categoria_correta === cat.categoria
          );
          if (fewShotMatch) {
            console.log(`[FEW-SHOT] ✅ Match exato: "${cat.descricao_raw}" → ${cat.categoria}`);
          }
        }

        console.log(`🤖 Claude categorizou ${parsed.length} transações`);

        return parsed;
      } catch (error) {
        lastError = error as Error;
        console.error(`❌ Attempt ${attempt} failed:`, lastError.message);

        if (attempt < 3) {
          // Esperar antes de tentar novamente
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    // Se todas as tentativas falharem, retornar transações não categorizadas
    console.error("❌ Claude falhou após 3 tentativas:", lastError?.message);

    return batch.map((t) => ({
      descricao_raw: t.descricao_raw,
      categoria: "Outros",
      subcategoria: null,
      score: 0,
      is_recorrente: false,
    }));
  }
}

// Singleton
let claudeServiceInstance: ClaudeService | null = null;

export function getClaudeService(): ClaudeService {
  if (!claudeServiceInstance) {
    claudeServiceInstance = new ClaudeService();
  }
  return claudeServiceInstance;
}