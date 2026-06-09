import Papa from "papaparse";

export interface ParsedTransaction {
  data: string; // YYYY-MM-DD
  valor: number;
  descricao_raw: string;
  tipo: "debito" | "credito";
}

// Detectar formato do banco baseado nos headers
function detectBankFormat(headers: string[]): string {
  const h = headers.map((x) => x.toLowerCase().trim());

  if (h.includes("categoria") && h.includes("título")) return "nubank";
  if (h.includes("data lançamento") || h.includes("historico")) return "inter";
  if (h.includes("itau") || (h.includes("data") && h.includes("historico") && h.includes("valor") && h.length === 3)) return "itau";
  if (h.includes("data") && h.includes("descrição") || h.includes("descricao")) return "generico";

  return "unknown";
}

// Converter data brasileira para ISO
function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;

  // Tentar DD/MM/YYYY
  const brMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (brMatch) {
    const [, day, month, year] = brMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  // Tentar YYYY-MM-DD (já ISO)
  const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return dateStr.slice(0, 10);
  }

  return null;
}

// Parsear valor brasileiro: 1.234,56 ou -1.234,56 ou R$ 1.234,56
function parseValor(valorStr: string): { valor: number; tipo: "debito" | "credito" } {
  if (!valorStr) return { valor: 0, tipo: "debito" };

  // Remover R$, espaços, etc
  let clean = valorStr.replace(/[R$\s]/g, "").trim();

  // Detectar se é negativo
  const isNegative = clean.startsWith("-") || clean.includes("(");
  clean = clean.replace(/[()-]/g, "").trim();

  // Remover pontos de milhar e trocar vírgula por ponto
  clean = clean.replace(/\./g, "").replace(",", ".");

  let valor = parseFloat(clean);
  if (isNaN(valor)) return { valor: 0, tipo: "debito" };

  // Débitos são negativos, créditos positivos
  if (isNegative && valor > 0) {
    valor = -valor;
  }

  return {
    valor,
    tipo: valor >= 0 ? "credito" : "debito",
  };
}

// Parser Nubank: data, categoria, título, valor
function parseNubank(rows: string[][]): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];

  for (let i = 1; i < rows.length; i++) {
    const [dataStr, , , , valorStr, descricao] = rows[i];
    const data = parseDate(dataStr);
    const { valor, tipo } = parseValor(valorStr);

    if (data && descricao) {
      transactions.push({
        data,
        valor,
        descricao_raw: descricao.trim(),
        tipo,
      });
    }
  }

  return transactions;
}

// Parser Inter: Data Lançamento, Histórico, Valor
function parseInter(rows: string[][]): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 3) continue;

    const dataStr = row[0];
    const historico = row[1];
    const valorStr = row[row.length - 1]; // Pode ter mais colunas

    const data = parseDate(dataStr);
    const { valor, tipo } = parseValor(valorStr);

    if (data && historico) {
      transactions.push({
        data,
        valor,
        descricao_raw: historico.trim(),
        tipo,
      });
    }
  }

  return transactions;
}

// Parser Genérico: detecta colunas automaticamente
function parseGeneric(rows: string[][]): ParsedTransaction[] {
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.toLowerCase().trim());
  const dataIdx = headers.findIndex((h) => h.includes("data"));
  const valorIdx = headers.findIndex((h) => h.includes("valor") || h.includes("value"));
  const descIdx = headers.findIndex((h) =>
    h.includes("descri") || h.includes("historico") || h.includes("titulo") || h.includes("title")
  );

  if (dataIdx === -1 || valorIdx === -1) return [];

  const transactions: ParsedTransaction[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const dataStr = row[dataIdx];
    const valorStr = row[valorIdx];
    const descricao = descIdx !== -1 ? row[descIdx] : row[0];

    const data = parseDate(dataStr);
    const { valor, tipo } = parseValor(valorStr);

    if (data) {
      transactions.push({
        data,
        valor,
        descricao_raw: descricao?.trim() || "",
        tipo,
      });
    }
  }

  return transactions;
}

export async function parseCSV(buffer: Buffer): Promise<ParsedTransaction[]> {
  return new Promise((resolve, reject) => {
    const text = buffer.toString("utf-8");

    Papa.parse<string[]>(text, {
      complete: (results) => {
        const rows = results.data as string[][];

        if (rows.length < 2) {
          resolve([]);
          return;
        }

        const headers = rows[0];
        const format = detectBankFormat(headers);

        let transactions: ParsedTransaction[] = [];

        switch (format) {
          case "nubank":
            transactions = parseNubank(rows);
            break;
          case "inter":
            transactions = parseInter(rows);
            break;
          default:
            transactions = parseGeneric(rows);
        }

        console.log(`📊 CSV parseado: ${transactions.length} transações (formato: ${format})`);
        resolve(transactions);
      },
      error: (error) => {
        console.error("❌ Erro ao parsear CSV:", error.message);
        reject(error);
      },
    });
  });
}