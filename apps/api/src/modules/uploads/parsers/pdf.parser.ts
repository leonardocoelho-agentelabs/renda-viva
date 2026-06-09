import pdf from "pdf-parse";

export interface ParsedTransaction {
  data: string; // YYYY-MM-DD
  valor: number;
  descricao_raw: string;
  tipo: "debito" | "credito";
}

// Converter data brasileira para ISO
function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;

  // Tentar DD/MM/YYYY ou DD/MM/YY
  const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (match) {
    let [, day, month, year] = match;
    if (year.length === 2) {
      year = (parseInt(year) > 50 ? "19" : "20") + year;
    }
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return null;
}

// Parsear valor brasileiro
function parseValor(valorStr: string): { valor: number; tipo: "debito" | "credito" } {
  if (!valorStr) return { valor: 0, tipo: "debito" };

  let clean = valorStr.replace(/[R$\s]/g, "").trim();

  // Detectar se é negativo
  const isNegative = clean.startsWith("-") || clean.startsWith("(");
  clean = clean.replace(/[()-]/g, "").trim();

  // Remover pontos de milhar e trocar vírgula por ponto
  clean = clean.replace(/\./g, "").replace(",", ".");

  let valor = parseFloat(clean);
  if (isNaN(valor)) return { valor: 0, tipo: "debito" };

  if (isNegative && valor > 0) {
    valor = -valor;
  }

  return {
    valor,
    tipo: valor >= 0 ? "credito" : "debito",
  };
}

export async function parsePDF(buffer: Buffer): Promise<ParsedTransaction[]> {
  const transactions: ParsedTransaction[] = [];

  try {
    const data = await pdf(buffer);
    const text = data.text;

    // Regex para detectar linhas de transação
    // Padrão: data + descrição + valor
    // Exemplo: 15/06/2024 COMPRA DEBITO ITAU SHOPPING    -125,90

    const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);

    for (const line of lines) {
      // Tentar encontrar padrão: data DD/MM/YYYY
      const dateMatch = line.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(.+?)\s+(-?[\d.,]+)$/);

      if (dateMatch) {
        const [, dateStr, descricao, valorStr] = dateMatch;
        const data = parseDate(dateStr);
        const { valor, tipo } = parseValor(valorStr);

        if (data && descricao.trim().length > 2) {
          transactions.push({
            data,
            valor,
            descricao_raw: descricao.trim(),
            tipo,
          });
          continue;
        }
      }

      // Tentar padrão alternativo: descrição + data + valor
      const altMatch = line.match(/(.+?)\s+(\d{1,2}\/\d{1,2})\s+(-?[\d.,]+)$/);
      if (altMatch && !dateMatch) {
        const [, descricao, dateStr, valorStr] = altMatch;
        const data = parseDate(dateStr);
        const { valor, tipo } = parseValor(valorStr);

        if (data && descricao.trim().length > 2) {
          transactions.push({
            data,
            valor,
            descricao_raw: descricao.trim(),
            tipo,
          });
        }
      }
    }

    console.log(`📄 PDF parseado: ${transactions.length} transações`);

  } catch (error) {
    console.error("❌ Erro ao parsear PDF:", error);
  }

  return transactions;
}