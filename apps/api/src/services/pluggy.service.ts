import { env } from "../env.js";

const PLUGGY_BASE_URL = "https://api.pluggy.ai";

let apiKeyCache: { key: string; expiresAt: number } | null = null;

export interface PluggyTransaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: "CREDIT" | "DEBIT";
  category?: string;
  accountId: string;
}

export interface PluggyItem {
  id: string;
  status: string;
  institution?: { name?: string; imageUrl?: string };
  lastUpdatedAt?: string;
}

// Obtém a API key da Pluggy (válida por ~2 horas) usando clientId/clientSecret.
async function getApiKey(): Promise<string> {
  if (apiKeyCache && Date.now() < apiKeyCache.expiresAt) {
    return apiKeyCache.key;
  }

  const response = await fetch(`${PLUGGY_BASE_URL}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: env.PLUGGY_CLIENT_ID,
      clientSecret: env.PLUGGY_CLIENT_SECRET,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Pluggy auth error: ${JSON.stringify(data)}`);
  }

  apiKeyCache = {
    key: data.apiKey,
    expiresAt: Date.now() + 2 * 60 * 60 * 1000 - 5 * 60 * 1000, // 2h - 5min margem
  };

  return apiKeyCache.key;
}

// Cria um Connect Token para abrir o widget Pluggy no frontend.
export async function criarConnectToken(userId: string): Promise<string> {
  const apiKey = await getApiKey();

  const response = await fetch(`${PLUGGY_BASE_URL}/connect_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify({
      clientUserId: userId,
      webhookUrl: env.PLUGGY_WEBHOOK_URL,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Erro ao criar connect token: ${JSON.stringify(data)}`);
  }

  return data.accessToken;
}

// Busca as transações de todas as contas de um item, no período informado.
export async function buscarTransacoes(
  itemId: string,
  dataInicio: string,
  dataFim: string
): Promise<PluggyTransaction[]> {
  const apiKey = await getApiKey();

  const contasRes = await fetch(`${PLUGGY_BASE_URL}/accounts?itemId=${itemId}`, {
    headers: { "X-API-KEY": apiKey },
  });
  const contasData = await contasRes.json();
  const contas: Array<{ id: string }> = contasData.results || [];

  let todasTransacoes: PluggyTransaction[] = [];

  for (const conta of contas) {
    const txRes = await fetch(
      `${PLUGGY_BASE_URL}/transactions?accountId=${conta.id}&from=${dataInicio}&to=${dataFim}&pageSize=500`,
      { headers: { "X-API-KEY": apiKey } }
    );
    const txData = await txRes.json();
    todasTransacoes = [...todasTransacoes, ...((txData.results as PluggyTransaction[]) || [])];
  }

  return todasTransacoes;
}

// Busca os dados de um item (conexão bancária).
export async function buscarItem(itemId: string): Promise<PluggyItem> {
  const apiKey = await getApiKey();

  const response = await fetch(`${PLUGGY_BASE_URL}/items/${itemId}`, {
    headers: { "X-API-KEY": apiKey },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(`Erro ao buscar item: ${JSON.stringify(data)}`);
  }

  return response.json();
}
