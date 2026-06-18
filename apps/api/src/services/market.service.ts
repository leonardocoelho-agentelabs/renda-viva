export interface TesouroTitulo {
  nome: string;
  vencimento: string;
  taxaAnual: number;
  precoMinimo: number;
}

export interface FII {
  ticker: string;
  nome: string;
  segmento: string;
  dividendYield: number;
  pvp: number;
  precoAtual: number;
  ultimoDividendo: number;
  liquidezDiaria: number;
}

export interface AcaoB3 {
  ticker: string;
  nome: string;
  setor: string;
  precoAtual: number;
  dividendYield: number;
  pl: number;
  variacao12m: number;
}

export interface DadosMercado {
  selic: number;
  ipca: number;
  cdi: number;
  tesouroDireto: TesouroTitulo[];
  fiis: FII[];
  acoes: AcaoB3[];
  coletadoEm: string;
}

// Ações monitoradas (blue chips brasileiras)
const ACOES_MONITORADAS = [
  { ticker: "PETR4", nome: "Petrobras", setor: "Energia" },
  { ticker: "VALE3", nome: "Vale", setor: "Mineração" },
  { ticker: "ITUB4", nome: "Itaú Unibanco", setor: "Financeiro" },
  { ticker: "BBDC4", nome: "Bradesco", setor: "Financeiro" },
  { ticker: "WEGE3", nome: "WEG", setor: "Indústria" },
  { ticker: "RENT3", nome: "Localiza", setor: "Serviços" },
  { ticker: "RADL3", nome: "Raia Drogasil", setor: "Saúde" },
  { ticker: "MGLU3", nome: "Magazine Luiza", setor: "Varejo" },
];

async function coletarFIIs(): Promise<FII[]> {
  try {
    const response = await fetch(
      "https://statusinvest.com.br/category/advancedsearchresult?" +
        "search=%7B%22Segment%22%3A%22%22%2C%22Yield%22%3A%7B%22Item1%22%3A6%2C%22Item2%22%3Anull%7D%2C%22PVP%22%3A%7B%22Item1%22%3Anull%2C%22Item2%22%3A1.1%7D%7D&CategoryType=2",
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; RendaViva/1.0)",
          Accept: "application/json",
          Referer: "https://statusinvest.com.br/fundos-imobiliarios",
        },
      }
    );

    if (!response.ok) return getFIIsFallback();

    const data = await response.json();
    const fiis = (data || []).slice(0, 10);

    return fiis
      .map((f: any) => ({
        ticker: f.ticker || "",
        nome: f.companyName || f.ticker || "",
        segmento: f.segment || "Diversificado",
        dividendYield: Number(f.dy) || 0,
        pvp: Number(f.p_vp) || 0,
        precoAtual: Number(f.price) || 0,
        ultimoDividendo: Number(f.lastDividend) || 0,
        liquidezDiaria: Number(f.liquidezMediaDiaria) || 0,
      }))
      .filter((f: FII) => f.ticker && f.dividendYield > 0);
  } catch {
    return getFIIsFallback();
  }
}

function getFIIsFallback(): FII[] {
  return [
    {
      ticker: "MXRF11",
      nome: "Maxi Renda FII",
      segmento: "Papel",
      dividendYield: 12.5,
      pvp: 0.95,
      precoAtual: 10.5,
      ultimoDividendo: 0.1,
      liquidezDiaria: 15000000,
    },
    {
      ticker: "KNRI11",
      nome: "Kinea Renda Imobiliária",
      segmento: "Lajes Corporativas",
      dividendYield: 8.2,
      pvp: 0.88,
      precoAtual: 145.0,
      ultimoDividendo: 1.0,
      liquidezDiaria: 8000000,
    },
    {
      ticker: "HGLG11",
      nome: "CSHG Logística",
      segmento: "Logística",
      dividendYield: 9.1,
      pvp: 0.92,
      precoAtual: 165.0,
      ultimoDividendo: 1.25,
      liquidezDiaria: 6000000,
    },
    {
      ticker: "VISC11",
      nome: "Vinci Shopping Centers",
      segmento: "Shoppings",
      dividendYield: 7.8,
      pvp: 0.85,
      precoAtual: 112.0,
      ultimoDividendo: 0.85,
      liquidezDiaria: 5000000,
    },
    {
      ticker: "XPLG11",
      nome: "XP Log",
      segmento: "Logística",
      dividendYield: 10.2,
      pvp: 1.05,
      precoAtual: 98.5,
      ultimoDividendo: 0.82,
      liquidezDiaria: 4000000,
    },
  ];
}

async function coletarAcoes(): Promise<AcaoB3[]> {
  try {
    const tickers = ACOES_MONITORADAS.map((a) => a.ticker).join(",");
    const response = await fetch(
      `https://brapi.dev/api/quote/${tickers}?range=1y&interval=1mo&fundamental=true`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; RendaViva/1.0)",
        },
      }
    );

    if (!response.ok) return getAcoesFallback();

    const data = await response.json();
    const results = data?.results || [];

    return results
      .map((a: any) => {
        const info = ACOES_MONITORADAS.find((m) => m.ticker === a.symbol);
        return {
          ticker: a.symbol,
          nome: info?.nome || a.longName || a.symbol,
          setor: info?.setor || "Diversificado",
          precoAtual: Number(a.regularMarketPrice) || 0,
          dividendYield: Number(a.dividendYield) || 0,
          pl: Number(a.priceEarningsRatio) || 0,
          variacao12m:
            Number(a.fiftyTwoWeekHigh) > 0
              ? ((Number(a.regularMarketPrice) - Number(a.fiftyTwoWeekLow)) /
                  Number(a.fiftyTwoWeekLow) *
                  100)
              : 0,
        };
      })
      .filter((a: AcaoB3) => a.precoAtual > 0);
  } catch {
    return getAcoesFallback();
  }
}

function getAcoesFallback(): AcaoB3[] {
  return [
    {
      ticker: "PETR4",
      nome: "Petrobras",
      setor: "Energia",
      precoAtual: 38.5,
      dividendYield: 14.2,
      pl: 4.5,
      variacao12m: 12.3,
    },
    {
      ticker: "VALE3",
      nome: "Vale",
      setor: "Mineração",
      precoAtual: 62.8,
      dividendYield: 9.8,
      pl: 5.2,
      variacao12m: -8.1,
    },
    {
      ticker: "WEGE3",
      nome: "WEG",
      setor: "Indústria",
      precoAtual: 42.3,
      dividendYield: 2.1,
      pl: 28.5,
      variacao12m: 18.7,
    },
    {
      ticker: "ITUB4",
      nome: "Itaú Unibanco",
      setor: "Financeiro",
      precoAtual: 32.8,
      dividendYield: 7.5,
      pl: 9.2,
      variacao12m: 5.4,
    },
    {
      ticker: "RENT3",
      nome: "Localiza",
      setor: "Serviços",
      precoAtual: 48.9,
      dividendYield: 3.8,
      pl: 22.1,
      variacao12m: -3.2,
    },
  ];
}

async function jsonOuNull<T>(res: PromiseSettledResult<Response>): Promise<T | null> {
  if (res.status !== "fulfilled" || !res.value.ok) return null;
  try {
    return (await res.value.json()) as T;
  } catch {
    return null;
  }
}

export async function coletarDadosMercado(): Promise<DadosMercado> {
  const [selicRes, ipcaRes, cdiRes, tesouroRes, fiisResult, acoesResult] = await Promise.allSettled([
    fetch("https://api.bcb.gov.br/dados/serie/bcdata.sgs.11/dados/ultimos/1?formato=json"),
    fetch("https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados/ultimos/1?formato=json"),
    fetch("https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/1?formato=json"),
    fetch("https://www.tesourodireto.com.br/json/br/com/b3/tesourodireto/model/json/response.json"),
    coletarFIIs(),
    coletarAcoes(),
  ]);

  // Defaults razoáveis caso alguma API falhe
  let selic = 13.75;
  let ipca = 4.5;
  let cdi = 13.65;
  let tesouroDireto: TesouroTitulo[] = [];

  const selicData = await jsonOuNull<SgsPonto[]>(selicRes);
  if (selicData?.[0]?.valor) selic = parseFloat(selicData[0].valor);

  const ipcaData = await jsonOuNull<SgsPonto[]>(ipcaRes);
  if (ipcaData?.[0]?.valor) ipca = parseFloat(ipcaData[0].valor);

  const cdiData = await jsonOuNull<SgsPonto[]>(cdiRes);
  if (cdiData?.[0]?.valor) cdi = parseFloat(cdiData[0].valor);

  const tesouroData = await jsonOuNull<{
    response?: { TrsrBdTradgList?: Array<{ TrsrBd?: Record<string, unknown> }> };
  }>(tesouroRes);
  const titulos = tesouroData?.response?.TrsrBdTradgList || [];
  tesouroDireto = titulos.slice(0, 5).map((t) => {
    const bd = (t.TrsrBd || {}) as Record<string, unknown>;
    return {
      nome: String(bd.nm ?? "Tesouro"),
      vencimento: String(bd.mtrtyDt ?? ""),
      taxaAnual: parseFloat(String(bd.anulInvstmtRate ?? "0")) || 0,
      precoMinimo: parseFloat(String(bd.minInvstmtAmt ?? "0")) || 0,
    };
  });

  return {
    selic,
    ipca,
    cdi,
    tesouroDireto,
    fiis: fiisResult.status === "fulfilled" ? fiisResult.value : getFIIsFallback(),
    acoes: acoesResult.status === "fulfilled" ? acoesResult.value : getAcoesFallback(),
    coletadoEm: new Date().toISOString(),
  };
}
