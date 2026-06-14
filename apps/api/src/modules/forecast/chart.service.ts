import { supabaseAdmin } from '../../plugins/supabase.js';

export interface PontoGrafico {
  data: string;
  saldo: number;
  tipo: 'historico' | 'projecao';
}

export interface Marcador {
  data: string;
  label: string;
  tipo: 'positivo' | 'negativo' | 'neutro';
}

export interface DadosGrafico {
  pontos: PontoGrafico[];
  marcadores: Marcador[];
}

export async function gerarDadosGrafico(
  userId: string,
  periodo: '7d' | '30d' | '90d' | '12m'
): Promise<DadosGrafico> {
  const hoje = new Date();
  const pontos: PontoGrafico[] = [];
  const marcadores: Marcador[] = [];

  if (periodo === '7d' || periodo === '30d') {
    // Usar previsão futura
    const limite = periodo === '7d' ? 7 : 30;
    const { data: previsoes } = await supabaseAdmin
      .from('forecasts')
      .select('data_prevista, saldo_projetado')
      .eq('user_id', userId)
      .gte('data_prevista', hoje.toISOString().split('T')[0])
      .order('data_prevista', { ascending: true })
      .limit(limite);

    if (previsoes) {
      previsoes.forEach((p) => {
        pontos.push({ data: p.data_prevista, saldo: p.saldo_projetado, tipo: 'projecao' });
      });

      // Marcador: início do saldo negativo
      const primeiroNegativo = previsoes.find((p) => p.saldo_projetado < 0);
      if (primeiroNegativo) {
        marcadores.push({
          data: primeiroNegativo.data_prevista,
          label: 'Início do saldo negativo',
          tipo: 'negativo',
        });
      }
    }
  } else {
    // Histórico real (90d ou 12m)
    const diasHistorico = periodo === '90d' ? 90 : 365;
    const inicio = new Date(hoje);
    inicio.setDate(inicio.getDate() - diasHistorico);

    const { data: transacoes } = await supabaseAdmin
      .from('transactions')
      .select('data, valor, categoria, is_recorrente, descricao_raw')
      .eq('user_id', userId)
      .gte('data', inicio.toISOString().split('T')[0])
      .lte('data', hoje.toISOString().split('T')[0])
      .order('data', { ascending: true });

    if (!transacoes || transacoes.length === 0) {
      return { pontos: [], marcadores: [] };
    }

    // Calcular saldo acumulado por dia (ou agrupado por mês para 12m)
    const agrupamento = periodo === '12m' ? 'mes' : 'dia';
    const saldoPorData: Record<string, number> = {};
    let acumulado = 0;

    transacoes.forEach((t) => {
      acumulado += t.valor;
      const chave = agrupamento === 'mes' ? t.data.slice(0, 7) + '-01' : t.data;
      saldoPorData[chave] = acumulado;
    });

    Object.entries(saldoPorData).forEach(([data, saldo]) => {
      pontos.push({ data, saldo, tipo: 'historico' });
    });

    // Marcadores: maior receita recorrente (salário) e maior despesa recorrente em Moradia (aluguel)
    const receitasRecorrentes = transacoes.filter((t) => t.valor > 0 && t.is_recorrente);
    const maiorReceita = [...receitasRecorrentes].sort((a, b) => b.valor - a.valor)[0];
    if (maiorReceita) {
      marcadores.push({ data: maiorReceita.data, label: 'Salário recebido', tipo: 'positivo' });
    }

    const despesasMoradia = transacoes.filter(
      (t) => t.valor < 0 && t.is_recorrente && t.categoria === 'Moradia'
    );
    const maiorAluguel = [...despesasMoradia].sort((a, b) => a.valor - b.valor)[0];
    if (maiorAluguel) {
      marcadores.push({ data: maiorAluguel.data, label: 'Pagamento do aluguel', tipo: 'neutro' });
    }
  }

  return { pontos, marcadores };
}
