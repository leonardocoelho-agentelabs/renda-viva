export interface TesouroTitulo {
  nome: string;
  vencimento: string;
  taxaAnual: number;
  precoMinimo: number;
}

export interface DadosMercado {
  selic: number;
  ipca: number;
  cdi: number;
  tesouroDireto: TesouroTitulo[];
  coletadoEm: string;
}

interface SgsPonto {
  data?: string;
  valor?: string;
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
  const [selicRes, ipcaRes, cdiRes, tesouroRes] = await Promise.allSettled([
    fetch("https://api.bcb.gov.br/dados/serie/bcdata.sgs.11/dados/ultimos/1?formato=json"),
    fetch("https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados/ultimos/1?formato=json"),
    fetch("https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/1?formato=json"),
    fetch("https://www.tesourodireto.com.br/json/br/com/b3/tesourodireto/model/json/response.json"),
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
    coletadoEm: new Date().toISOString(),
  };
}
