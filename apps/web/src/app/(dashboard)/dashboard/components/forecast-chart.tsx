'use client';

import { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceDot,
} from 'recharts';
import { createClient } from '@/lib/supabase/client';
import { useTheme } from '@/components/theme/ThemeProvider';

type Periodo = '7d' | '30d' | '90d' | '12m';

const PERIODOS: { valor: Periodo; label: string }[] = [
  { valor: '7d', label: '7D' },
  { valor: '30d', label: '30D' },
  { valor: '90d', label: '90D' },
  { valor: '12m', label: '1A' },
];

interface Ponto {
  data: string;
  saldo: number;
  tipo: 'historico' | 'projecao';
}

interface Marcador {
  data: string;
  label: string;
  tipo: 'positivo' | 'negativo' | 'neutro';
}

export function ForecastChart() {
  const [periodo, setPeriodo] = useState<Periodo>('30d');
  const [pontos, setPontos] = useState<Ponto[]>([]);
  const [marcadores, setMarcadores] = useState<Marcador[]>([]);
  const [loading, setLoading] = useState(true);
  const { theme } = useTheme();
  const supabase = createClient();

  useEffect(() => {
    carregar();
  }, [periodo]);

  const carregar = async () => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/forecast/chart?periodo=${periodo}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      const json = await res.json();
      setPontos(json.pontos || []);
      setMarcadores(json.marcadores || []);
    } catch (e) {
      console.error('Erro ao carregar gráfico:', e);
    } finally {
      setLoading(false);
    }
  };

  const isDark = theme === 'dark';
  const gridColor = isDark ? '#1E293B' : '#F3F4F6';
  const axisColor = isDark ? '#64748B' : '#9CA3AF';

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-gray-100 dark:border-[#1E293B] shadow-[0_2px_10px_rgba(0,0,0,0.03)] p-6">
        <div className="h-64 bg-gray-50 dark:bg-[#1E293B] rounded-xl animate-pulse" />
      </div>
    );
  }

  if (pontos.length === 0) {
    return (
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-gray-100 dark:border-[#1E293B] shadow-[0_2px_10px_rgba(0,0,0,0.03)] p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-[#F8FAFC]">Evolução do saldo</h3>
          <PeriodoSelector periodo={periodo} setPeriodo={setPeriodo} />
        </div>
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-12">Sem dados suficientes para este período</p>
      </div>
    );
  }

  const chartData = pontos.map((p) => ({
    data: new Date(p.data + 'T00:00:00').toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      ...(periodo === '12m' ? { year: '2-digit' } : {}),
    }),
    dataRaw: p.data,
    saldo: p.saldo,
  }));

  const minSaldo = Math.min(...pontos.map((p) => p.saldo));
  const tituloPeriodo = periodo === '7d' || periodo === '30d' ? 'Previsão de saldo' : 'Evolução do saldo';
  const isProjecao = periodo === '7d' || periodo === '30d';

  return (
    <div className="bg-white dark:bg-[#111827] rounded-2xl border border-gray-100 dark:border-[#1E293B] shadow-[0_2px_10px_rgba(0,0,0,0.03)] p-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-[#F8FAFC]">{tituloPeriodo}</h3>
          <p className="text-xs text-gray-500 dark:text-[#94A3B8] mt-0.5">
            {isProjecao ? 'Baseado no seu histórico financeiro' : 'Saldo acumulado real'}
          </p>
        </div>
        <PeriodoSelector periodo={periodo} setPeriodo={setPeriodo} />
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="saldoGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#16a34a" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis
            dataKey="data"
            tick={{ fontSize: 11, fill: axisColor }}
            tickLine={false}
            axisLine={false}
            interval={Math.floor(chartData.length / 6)}
          />
          <YAxis
            tick={{ fontSize: 11, fill: axisColor }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) =>
              `R$ ${(v / 1000).toFixed(v >= 1000 ? 1 : 0)}${v >= 1000 ? 'k' : ''}`
            }
          />
          <Tooltip
            formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Saldo']}
            labelStyle={{ fontSize: 12, fontWeight: 500, color: isDark ? '#F8FAFC' : '#111827' }}
            contentStyle={{
              borderRadius: '12px',
              border: isDark ? '1px solid #1E293B' : '1px solid #E5E7EB',
              fontSize: 12,
              backgroundColor: isDark ? '#111827' : '#ffffff',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}
          />
          {minSaldo < 0 && (
            <ReferenceLine y={0} stroke="#EF4444" strokeDasharray="4 4" strokeWidth={1} />
          )}
          <Area
            type="monotone"
            dataKey="saldo"
            stroke="#16a34a"
            strokeWidth={2.5}
            fill="url(#saldoGradient)"
            dot={false}
            activeDot={{ r: 5, fill: '#16a34a', strokeWidth: 2, stroke: '#fff' }}
          />
          {marcadores.map((m, i) => {
            const ponto = chartData.find((c) => c.dataRaw === m.data);
            if (!ponto) return null;
            const cor = m.tipo === 'negativo' ? '#EF4444' : m.tipo === 'positivo' ? '#16a34a' : '#6B7280';
            return <ReferenceDot key={i} x={ponto.data} y={ponto.saldo} r={5} fill={cor} stroke="#fff" strokeWidth={2} />;
          })}
        </AreaChart>
      </ResponsiveContainer>

      {marcadores.length > 0 && (
        <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-[#1E293B]">
          {marcadores.map((m, i) => {
            const cor = m.tipo === 'negativo' ? 'text-red-600 dark:text-red-400' : m.tipo === 'positivo' ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400';
            const dataF = new Date(m.data + 'T00:00:00').toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'short',
            });
            return (
              <div key={i} className="flex items-center gap-1.5 text-xs">
                <span
                  className={`w-2 h-2 rounded-full ${
                    m.tipo === 'negativo' ? 'bg-red-500' : m.tipo === 'positivo' ? 'bg-green-500' : 'bg-gray-400'
                  }`}
                />
                <span className={`font-medium ${cor}`}>{m.label}</span>
                <span className="text-gray-400 dark:text-gray-500">· {dataF}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PeriodoSelector({
  periodo,
  setPeriodo,
}: {
  periodo: Periodo;
  setPeriodo: (p: Periodo) => void;
}) {
  return (
    <div className="flex bg-gray-100 dark:bg-[#1E293B] rounded-lg p-1">
      {PERIODOS.map((p) => (
        <button
          key={p.valor}
          onClick={() => setPeriodo(p.valor)}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
            periodo === p.valor
              ? 'bg-white dark:bg-[#111827] text-gray-900 dark:text-[#F8FAFC] shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
