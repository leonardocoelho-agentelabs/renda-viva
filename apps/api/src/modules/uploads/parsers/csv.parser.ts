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
// UTILITÁRIOS DE ENCODING E PARSING
// ============================================================

/**
 * Detecta e converte encoding ISO-8859-1 para UTF-8 se necessário
 */
function fixEncoding(buffer: Buffer): string {
  const utf8 = buffer.toString("utf-8");
  // Verifica se há caracteres de substituição que indicam problema de encoding
  if (!utf8.includes("�")) return utf8;
  // Fallback para latin1 (ISO-8859-1)
  return buffer.toString("latin1");
}

/**
 * Parse valor com parênteses (negativos) ou sinal D/C no final
 * Exemplos: "(1.234,56)" | "-1.234,56" | "1.234,56 D" | "500,00 C"
 */
function parseValueWithParens(raw: string): number {
  if (!raw || raw.trim() === "") return 0;

  const trimmed = raw.trim();

  // Detecta se é negativo: parênteses ou sinal D (débito)
  const isNegative =
    trimmed.startsWith("(") ||
    trimmed.startsWith("-") ||
    trimmed.includes(" D") ||
    trimmed.includes("D ") ||
    trimmed.includes(" D ") ||
    trimmed.endsWith(" D") ||
    trimmed.endsWith("d");

  // Remove parênteses, D/C, espaços e pontos de milhar
  const cleaned = trimmed
    .replace(/[()D Cd]/g, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const value = parseFloat(cleaned);
  if (isNaN(value)) return 0;

  return isNegative ? -Math.abs(value) : Math.abs(value);
}

/**
 * Parse valores de colunas Crédito/Débito separadas (Itaú)
 * Se Crédito preenchido → positivo; se Débito preenchido → negativo
 */
function parseCreditDebit(credito: string, debito: string): number {
  const creditVal = parseBRValue(credito);
  const debitVal = parseBRValue(debito);

  if (creditVal > 0) return creditVal;
  if (debitVal > 0) return -Math.abs(debitVal);
  return 0;
}

// ============================================================
// ETAPA 1 — Detecção automática de formato CSV
// ============================================================
type CSVFormat =
  | "inter"
  | "nubank"
  | "itau"
  | "bradesco"
  | "c6"
  | "santander"
  | "caixa"
  | "bb"
  | "unknown";

function detectCSVFormat(content: string): CSVFormat {
  const lines = content.split("\n").filter((l) => l.trim());
  const header = lines[0]?.toLowerCase() || "";
  const fullContent = content.toLowerCase();

  // Nubank — vírgula como separador, tem "identificador"
  if (header.includes("identificador") && header.includes(",")) {
    return "nubank";
  }

  // Banco Inter — separador ; e tem "histórico" e "lançamento"
  if (
    content.includes(";") &&
    (header.includes("histórico") || header.includes("historico")) &&
    (header.includes("valor") || header.includes("saldo"))
  ) {
    return "inter";
  }

  // Itaú — tem "débito" e "crédito" como colunas separadas
  if (
    header.includes("débito") ||
    header.includes("debito") ||
    header.includes("crédito") ||
    header.includes("credito") ||
    fullContent.includes("itau") ||
    fullContent.includes("itaú")
  ) {
    return "itau";
  }

  // Bradesco
  if (fullContent.includes("bradesco")) {
    return "bradesco";
  }

  // C6 Bank
  if (fullContent.includes("c6 bank") || fullContent.includes("c6bank")) {
    return "c6";
  }

  // Santander
  if (
    fullContent.includes("santander") ||
    header.includes("dt.mov") ||
    header.includes("dt. movimento")
  ) {
    return "santander";
  }

  // Caixa Econômica
  if (
    fullContent.includes("caixa econômica") ||
    fullContent.includes("caixa economica") ||
    fullContent.includes("cef")
  ) {
    return "caixa";
  }

  // Banco do Brasil
  if (
    fullContent.includes("banco do brasil") ||
    header.includes("dependencia origem")
  ) {
    return "bb";
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
// ETAPA 3 — Parser específico para Banco Inter
// ============================================================
function parseInterCSV(buffer: Buffer): ParsedTransaction[] {
  const content = fixEncoding(buffer).replace(/^﻿/, "");
  const lines = content.split("\n");

  // Encontrar a linha de cabeçalho real: contém "data" e "valor".
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
    if (valor === 0) continue;

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
// PARSER ITAÚ
// Colunas: Data | Histórico | Docto. | Crédito (R$) | Débito (R$) | Saldo (R$)
// ============================================================
function parseItauCSV(buffer: Buffer): ParsedTransaction[] {
  const content = fixEncoding(buffer).replace(/^﻿/, "");
  const lines = content.split("\n");

  // Encontrar linha do header com "Data"
  let headerIndex = -1;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    if (lines[i].toLowerCase().includes("data")) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) return [];

  const csvContent = lines.slice(headerIndex).join("\n");
  const result = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    delimiter: ";",
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const transactions: ParsedTransaction[] = [];

  for (const row of result.data) {
    const dataRaw = row["Data"] || row["DATA"] || row["data"];
    const historico = row["Histórico"] || row["Historico"] || row["Historria"] || "";
    const creditoRaw =
      row["Crédito (R$)"] ||
      row["Credito (R$)"] ||
      row["Crédito"] ||
      row["Credito"] ||
      "";
    const debitoRaw =
      row["Débito (R$)"] || row["Debito (R$)"] || row["Débito"] || row["Debito"] || "";

    if (!dataRaw) continue;

    const valor = parseCreditDebit(creditoRaw, debitoRaw);
    if (valor === 0) continue;

    const descricao_raw = historico.trim() || "Transação Itaú";

    transactions.push({
      data: parseBrazilianDate(dataRaw),
      valor,
      descricao_raw,
      tipo: detectTipo(historico, valor),
    });
  }

  return transactions;
}

// ============================================================
// PARSER BRADESCO
// Colunas: Data | Histórico | Valor | Saldo
// Valor negativo tem "-" ou está entre parênteses
// ============================================================
function parseBradescoCSV(buffer: Buffer): ParsedTransaction[] {
  const content = fixEncoding(buffer).replace(/^﻿/, "");
  const lines = content.split("\n");

  // Encontrar linha do header
  let headerIndex = -1;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    if (lines[i].toLowerCase().includes("data")) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) return [];

  const csvContent = lines.slice(headerIndex).join("\n");
  const result = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    delimiter: ";",
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const transactions: ParsedTransaction[] = [];

  for (const row of result.data) {
    const dataRaw = row["Data"] || row["DATA"] || row["data"];
    const historico = row["Histórico"] || row["Historico"] || row["Historria"] || "";
    const valorRaw = row["Valor"] || row["VALOR"] || row["valor"] || "";

    if (!dataRaw || !valorRaw) continue;

    const valor = parseValueWithParens(valorRaw);
    if (valor === 0) continue;

    const descricao_raw = historico.trim() || "Transação Bradesco";

    transactions.push({
      data: parseBrazilianDate(dataRaw),
      valor,
      descricao_raw,
      tipo: detectTipo(historico, valor),
    });
  }

  return transactions;
}

// ============================================================
// PARSER C6 BANK
// Colunas: Data | Descrição | Valor | Saldo
// Pode ter formato americano ou brasileiro — detectar automaticamente
// ============================================================
function parseC6CSV(buffer: Buffer): ParsedTransaction[] {
  const content = fixEncoding(buffer).replace(/^﻿/, "");
  const lines = content.split("\n");

  // Encontrar linha do header
  let headerIndex = -1;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    if (lines[i].toLowerCase().includes("data")) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) return [];

  const csvContent = lines.slice(headerIndex).join("\n");
  const result = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    delimiter: ";",
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const transactions: ParsedTransaction[] = [];

  for (const row of result.data) {
    const dataRaw = row["Data"] || row["DATA"] || row["data"];
    const descricao =
      row["Descrição"] || row["Descricao"] || row["Descricao"] || row["descricao"] || "";
    const valorRaw = row["Valor"] || row["VALOR"] || row["valor"] || "";

    if (!dataRaw || !valorRaw) continue;

    const valor = parseValueWithParens(valorRaw);
    if (valor === 0) continue;

    const descricao_raw = descricao.trim() || "Transação C6 Bank";

    transactions.push({
      data: parseBrazilianDate(dataRaw),
      valor,
      descricao_raw,
      tipo: detectTipo(descricao, valor),
    });
  }

  return transactions;
}

// ============================================================
// PARSER SANTANDER
// Colunas: Dt.Mov | Dt.Contáb | Histórico | Valor | Saldo
// Valor negativo tem parênteses
// ============================================================
function parseSantanderCSV(buffer: Buffer): ParsedTransaction[] {
  const content = fixEncoding(buffer).replace(/^﻿/, "");
  const lines = content.split("\n");

  // Encontrar linha do header com "Dt.Mov" ou "Data"
  let headerIndex = -1;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const line = lines[i].toLowerCase();
    if (line.includes("dt.mov") || line.includes("data") || line.includes("movimento")) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) return [];

  const csvContent = lines.slice(headerIndex).join("\n");
  const result = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    delimiter: ";",
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const transactions: ParsedTransaction[] = [];

  for (const row of result.data) {
    // Santander usa "Dt.Mov" para data do movimento
    const dataRaw =
      row["Dt.Mov"] || row["Dt.Movimento"] || row["Data"] || row["DATA"] || row["data"];
    const historico =
      row["Histórico"] || row["Historico"] || row["Historria"] || "";
    const valorRaw = row["Valor"] || row["VALOR"] || row["valor"] || "";

    if (!dataRaw || !valorRaw) continue;

    const valor = parseValueWithParens(valorRaw);
    if (valor === 0) continue;

    const descricao_raw = historico.trim() || "Transação Santander";

    transactions.push({
      data: parseBrazilianDate(dataRaw),
      valor,
      descricao_raw,
      tipo: detectTipo(historico, valor),
    });
  }

  return transactions;
}

// ============================================================
// PARSER CAIXA ECONÔMICA
// Colunas: Data | Histórico | Valor | Saldo
// Sinal: negativo tem "D" no final, positivo tem "C" (crédito)
// ============================================================
function parseCaixaCSV(buffer: Buffer): ParsedTransaction[] {
  const content = fixEncoding(buffer).replace(/^﻿/, "");
  const lines = content.split("\n");

  // Encontrar linha do header
  let headerIndex = -1;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    if (lines[i].toLowerCase().includes("data")) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) return [];

  const csvContent = lines.slice(headerIndex).join("\n");
  const result = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    delimiter: ";",
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const transactions: ParsedTransaction[] = [];

  for (const row of result.data) {
    const dataRaw = row["Data"] || row["DATA"] || row["data"];
    const historico = row["Histórico"] || row["Historico"] || row["Historria"] || "";
    const valorRaw = row["Valor"] || row["VALOR"] || row["valor"] || "";

    if (!dataRaw || !valorRaw) continue;

    // Caixa usa "D" e "C" no final do valor
    const valor = parseValueWithParens(valorRaw);
    if (valor === 0) continue;

    const descricao_raw = historico.trim() || "Transação Caixa";

    transactions.push({
      data: parseBrazilianDate(dataRaw),
      valor,
      descricao_raw,
      tipo: detectTipo(historico, valor),
    });
  }

  return transactions;
}

// ============================================================
// PARSER BANCO DO BRASIL
// Colunas: Data | Dependencia Origem | Histórico | Data Balancete | Número do documento | Valor
// ============================================================
function parseBBCSV(buffer: Buffer): ParsedTransaction[] {
  const content = fixEncoding(buffer).replace(/^﻿/, "");
  const lines = content.split("\n");

  // Encontrar linha do header com "Data" e "Histórico"
  let headerIndex = -1;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const line = lines[i].toLowerCase();
    if (line.includes("data") && line.includes("histórico")) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    // Tentar só com "Data"
    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      if (lines[i].toLowerCase().includes("data")) {
        headerIndex = i;
        break;
      }
    }
  }

  if (headerIndex === -1) return [];

  const csvContent = lines.slice(headerIndex).join("\n");
  const result = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    delimiter: ";",
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const transactions: ParsedTransaction[] = [];

  for (const row of result.data) {
    const dataRaw = row["Data"] || row["DATA"] || row["data"];
    const historico =
      row["Histórico"] || row["Historico"] || row["Historria"] || "";
    const valorRaw = row["Valor"] || row["VALOR"] || row["valor"] || "";

    if (!dataRaw || !valorRaw) continue;

    const valor = parseValueWithParens(valorRaw);
    if (valor === 0) continue;

    const descricao_raw = historico.trim() || "Transação Banco do Brasil";

    transactions.push({
      data: parseBrazilianDate(dataRaw),
      valor,
      descricao_raw,
      tipo: detectTipo(historico, valor),
    });
  }

  return transactions;
}

// ============================================================
// PARSER PRINCIPAL COM DETECÇÃO AUTOMÁTICA
// ============================================================
export async function parseCSV(buffer: Buffer): Promise<ParsedTransaction[]> {
  const content = fixEncoding(buffer).replace(/^﻿/, "");
  const format = detectCSVFormat(content);

  console.log(`[CSV PARSER] Banco detectado: ${format}`);

  let transactions: ParsedTransaction[] = [];

  switch (format) {
    case "nubank":
      transactions = parseNubankCSV(content);
      break;
    case "inter":
      transactions = parseInterCSV(buffer);
      break;
    case "itau":
      transactions = parseItauCSV(buffer);
      break;
    case "bradesco":
      transactions = parseBradescoCSV(buffer);
      break;
    case "c6":
      transactions = parseC6CSV(buffer);
      break;
    case "santander":
      transactions = parseSantanderCSV(buffer);
      break;
    case "caixa":
      transactions = parseCaixaCSV(buffer);
      break;
    case "bb":
      transactions = parseBBCSV(buffer);
      break;
    case "unknown":
    default:
      // Tentar parsing genérico primeiro
      console.log("[CSV PARSER] Formato desconhecido, tentando parser genérico...");

      // Tenta Inter como fallback (mais comum)
      transactions = parseInterCSV(buffer);

      // Se não encontrou nada, lança erro amigável
      if (transactions.length === 0) {
        throw new Error(
          "Formato de extrato não reconhecido. " +
            "Bancos suportados: Banco Inter, Nubank, Itaú, Bradesco, " +
            "C6 Bank, Santander, Caixa Econômica e Banco do Brasil. " +
            "Verifique se o arquivo é um extrato CSV válido."
        );
      }
      break;
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