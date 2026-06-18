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

// ============================================================
// ETAPA 1 — Detecção automática de formato CSV
// ============================================================
type CSVFormat = "inter" | "nubank" | "unknown";

function detectCSVFormat(content: string): CSVFormat {
  const lines = content.split("\n").filter((l) => l.trim());

  // Formato Nubank: header na linha 1 com "Data,Valor,Identificador"
  if (lines[0]?.includes("Data,Valor,Identificador")) {
    return "nubank";
  }

  // Formato Banco Inter: separador ";" e header após linhas de metadados
  if (
    content.includes(";") &&
    (content.includes("Data Lançamento") ||
      content.includes("Histórico") ||
      content.includes("Lançamento"))
  ) {
    return "inter";
  }

  // Fallback: tentar detectar pelo separador predominante
  const semicolons = (lines[0]?.match(/;/g) || []).length;
  const commas = (lines[0]?.match(/,/g) || []).length;
  if (semicolons > commas) return "inter";
  if (commas >= 3) return "nubank";

  return "unknown";
}

// ============================================================
// ETAPA 2 — Parser específico para Nubank
// ============================================================

// Helper para split respeitando aspas
function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseNubankCSV(content: string): ParsedTransaction[] {
  // Remove BOM
  const cleanContent = content.replace(/^﻿/, "");
  const lines = cleanContent.split("\n").filter((l) => l.trim());

  // Pular header (linha 0: "Data,Valor,Identificador,Descrição")
  const dataLines = lines.slice(1);

  const transactions: ParsedTransaction[] = [];

  for (const line of dataLines) {
    if (!line.trim()) continue;

    // Split por vírgula respeitando campos entre aspas
    const parts = splitCSVLine(line);
    if (parts.length < 4) continue;

    const [dateRaw, valorRaw, _identificador, ...descParts] = parts;
    const descricao = descParts.join(",").trim().replace(/^"|"$/g, "");

    // Parse data DD/MM/YYYY → YYYY-MM-DD
    const [dia, mes, ano] = dateRaw.trim().split("/");
    if (!dia || !mes || !ano) continue;
    const data = `${ano}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;

    // Parse valor (já em formato americano: 1894.00 ou -1890.00)
    const valor = parseFloat(valorRaw.trim());
    if (isNaN(valor)) continue;

    // Determinar tipo
    let tipo: ParsedTransaction["tipo"] = valor < 0 ? "debito" : "credito";
    const descLower = descricao.toLowerCase();
    if (descLower.includes("pix")) tipo = "pix";
    else if (
      descLower.includes("transferência") ||
      descLower.includes("transferencia")
    )
      tipo = "transferencia";

    transactions.push({ data, valor, descricao_raw: descricao, tipo });
  }

  return transactions;
}

// ============================================================
// ETAPA 4 — Parser específico para Banco Inter (encapsulado)
// ============================================================
function parseInterCSV(buffer: Buffer): ParsedTransaction[] {
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
      (line.includes("valor") ||
        line.includes("value") ||
        line.includes("amount"))
    ) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    console.error(
      "[CSV Parser] Header não encontrado (procurando colunas 'data' e 'valor')"
    );
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
      row["Data Lançamento"] ||
      row["Data Lancamento"] ||
      row["Data"] ||
      row["DATA"] ||
      row["date"];
    const valorRaw =
      row["Valor"] ||
      row["VALOR"] ||
      row["value"] ||
      row["amount"] ||
      row["Valor Débito"] ||
      row["Valor Crédito"] ||
      row["Debito"] ||
      row["Credito"];

    // LOG DIAGNÓSTICO: primeiras 3 transações para verificar parsing de valores
    if (diagnosticCount < 3 && valorRaw) {
      diagnosticCount++;
      console.log(`[CSV PARSER] Raw value: "${valorRaw}"`);
      console.log(`[CSV PARSER] Parsed value: ${parseBRValue(String(valorRaw))}`);
    }
    const historico =
      row["Histórico"] || row["Historico"] || row["historico"] || "";
    const descricao =
      row["Descrição"] ||
      row["Descricao"] ||
      row["descricao"] ||
      row["title"] ||
      "";

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

  return transactions;
}

// ============================================================
// ETAPA 3 — Parser principal com detecção automática
// ============================================================
export async function parseCSV(buffer: Buffer): Promise<ParsedTransaction[]> {
  const content = buffer.toString("utf-8").replace(/^﻿/, "");
  const format = detectCSVFormat(content);

  console.log(`[CSV PARSER] Formato detectado: ${format}`);

  let transactions: ParsedTransaction[] = [];

  if (format === "nubank") {
    transactions = parseNubankCSV(content);
  } else if (format === "inter") {
    transactions = parseInterCSV(buffer);
  } else {
    // Tentar Nubank como fallback
    console.log("[CSV PARSER] Formato desconhecido, tentando Nubank...");
    transactions = parseNubankCSV(content);
  }

  console.log(`[CSV PARSER] ${transactions.length} transações extraídas`);

  // Mostrar as 3 primeiras para debug
  transactions.slice(0, 3).forEach((t, i) => {
    console.log(
      `[CSV PARSER] tx[${i}]: ${t.data} | ${t.valor} | ${t.descricao_raw.slice(0, 50)}`
    );
  });

  return transactions;
}