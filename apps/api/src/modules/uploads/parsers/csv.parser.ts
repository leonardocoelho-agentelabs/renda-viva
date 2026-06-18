import Papa from "papaparse";

export interface ParsedTransaction {
  data: string; // YYYY-MM-DD
  valor: number;
  descricao_raw: string;
  tipo: "debito" | "credito" | "pix" | "transferencia";
}

// ============================================================
// FUNÇÃO CORRETA para parsing de valores brasileiros
// Exemplos de entrada: "76,00" | "-76,00" | "1.234,56" | "R$ 1.234,56"
// Exemplos de saída:    76.00  |  -76.00  |   1234.56  |   1234.56
// ============================================================
function parseBRValue(raw: string): number {
  if (!raw || raw.trim() === "") return 0;

  const cleaned = raw
    .trim()
    .replace(/\s/g, "") // remove espaços
    .replace(/R\$/g, "") // remove símbolo R$
    .replace(/\./g, "") // remove pontos de milhar: "1.234,56" → "1234,56"
    .replace(",", "."); // troca vírgula decimal por ponto: "1234,56" → "1234.56"

  const value = parseFloat(cleaned);
  return isNaN(value) ? 0 : value;
}

// Mantém parseBrazilianNumber como alias para compatibilidade
function parseBrazilianNumber(value: string): number {
  return parseBRValue(value);
}

// Converte data DD/MM/YYYY para YYYY-MM-DD (mantém ISO se já estiver nesse formato)
function parseBrazilianDate(dateStr: string): string {
  const trimmed = dateStr.trim();

  const parts = trimmed.split("/");
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
  }

  // Já em ISO (YYYY-MM-DD)
  const isoMatch = trimmed.match(/^\d{4}-\d{2}-\d{2}/);
  if (isoMatch) return trimmed.slice(0, 10);

  return trimmed;
}

// Determina o tipo a partir do histórico e do sinal do valor
function detectTipo(historico: string, valor: number): ParsedTransaction["tipo"] {
  const h = (historico || "").toLowerCase();
  if (h.includes("pix")) return "pix";
  if (h.includes("transfer")) return "transferencia";
  if (h.includes("compra")) return "debito";
  if (valor > 0) return "credito";
  return "debito";
}

export async function parseCSV(buffer: Buffer): Promise<ParsedTransaction[]> {
  // Contador para logs de diagnóstico (mostra apenas as 3 primeiras linhas)
  let diagnosticCount = 0;

  // Remove BOM (byte order mark) que alguns bancos colocam no início do arquivo
  const content = buffer.toString("utf-8").replace(/^﻿/, "");
  const lines = content.split("\n");

  // Encontrar a linha de cabeçalho real: contém "data" e "valor".
  // Bancos como o Inter colocam metadados nas primeiras linhas.
  let headerIndex = -1;
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const line = lines[i].toLowerCase();
    if (
      (line.includes("data") || line.includes("date")) &&
      (line.includes("valor") || line.includes("value") || line.includes("amount"))
    ) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    console.error("[CSV Parser] Header não encontrado (procurando colunas 'data' e 'valor')");
    return [];
  }

  // Detectar separador a partir da linha de cabeçalho
  const headerLine = lines[headerIndex];
  const separator = headerLine.includes(";") ? ";" : ",";

  // Parsear a partir do cabeçalho (descartando metadados acima)
  const csvContent = lines.slice(headerIndex).join("\n");

  const result = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    delimiter: separator,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const transactions: ParsedTransaction[] = [];

  for (const row of result.data) {
    // Identificar colunas por nome (case-insensitive nas variações comuns)
    const dataRaw =
      row["Data Lançamento"] || row["Data Lancamento"] || row["Data"] ||
      row["DATA"] || row["date"];
    const valorRaw =
      row["Valor"] || row["VALOR"] || row["value"] || row["amount"] ||
      row["Valor Débito"] || row["Valor Crédito"] || row["Debito"] || row["Credito"];

    // LOG DIAGNÓSTICO: primeiras 3 transações para verificar parsing de valores
    if (diagnosticCount < 3 && valorRaw) {
      diagnosticCount++;
      console.log(`[CSV PARSER] Raw value: "${valorRaw}"`);
      console.log(`[CSV PARSER] Parsed value: ${parseBRValue(String(valorRaw))}`);
    }
    const historico =
      row["Histórico"] || row["Historico"] || row["historico"] || "";
    const descricao =
      row["Descrição"] || row["Descricao"] || row["descricao"] ||
      row["title"] || "";

    if (!dataRaw || !valorRaw) continue;

    const valor = parseBrazilianNumber(String(valorRaw));
    if (valor === 0) continue; // Ignorar linhas com valor zero (ex: saldo)

    // descricao_raw = Histórico + ": " + Descrição quando ambos existirem
    const h = historico.trim();
    const d = descricao.trim();
    const descricao_raw = h && d ? `${h}: ${d}` : h || d || "Transação";

    transactions.push({
      data: parseBrazilianDate(String(dataRaw)),
      valor,
      descricao_raw,
      tipo: detectTipo(historico, valor),
    });
  }

  console.log(
    `[CSV Parser] ${transactions.length} transações parseadas (separador: '${separator}')`
  );
  return transactions;
}
