"use client";

import { useState } from "react";
import { AlertTriangle, TrendingDown, ArrowRight, MessageCircle, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface ModoCrisePanelProps {
  totalEntradas: number;
  totalGastos: number;
  saldo: number;
  onDesativar?: () => void;
}

export function ModoCrisePanel({
  totalEntradas,
  totalGastos,
  saldo,
  onDesativar,
}: ModoCrisePanelProps) {
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const supabase = createClient();

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const handleDesativar = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
      const res = await fetch(`${apiUrl}/users/modo-crise`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok && onDesativar) {
        onDesativar();
      }
    } catch (err) {
      console.error("Erro ao desativar modo crise:", err);
    } finally {
      setLoading(false);
      setShowConfirm(false);
    }
  };

  // Categorias prioritárias (mock - idealmente viria da API)
  const prioridades = [
    { nome: "Moradia", valor: Math.round(totalGastos * 0.35) },
    { nome: "Alimentação", valor: Math.round(totalGastos * 0.25) },
    { nome: "Transporte", valor: Math.round(totalGastos * 0.2) },
    { nome: "Contas/Serviços", valor: Math.round(totalGastos * 0.2) },
  ];

  return (
    <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-2xl overflow-hidden mb-6">
      {/* Header */}
      <div className="bg-red-100 dark:bg-red-900/30 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-200 dark:bg-red-800/50 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h2 className="text-red-700 dark:text-red-400 font-semibold text-lg">
              Modo Crise Ativado
            </h2>
            <p className="text-red-600 dark:text-red-500 text-sm">
              Detectamos sinais de estresse financeiro
            </p>
          </div>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="px-6 py-4">
        <div className="grid grid-cols-3 gap-4 mb-6">
          {/* Entra */}
          <div className="bg-white dark:bg-rv-dark-card rounded-xl p-4 border border-green-200 dark:border-green-800/30 text-center">
            <p className="text-green-600 dark:text-green-400 text-xs font-medium uppercase tracking-wide mb-1">
              Entra
            </p>
            <p className="text-green-700 dark:text-green-400 text-xl font-bold">
              {formatCurrency(totalEntradas)}
            </p>
          </div>

          {/* Precisa sair */}
          <div className="bg-white dark:bg-rv-dark-card rounded-xl p-4 border border-red-200 dark:border-red-800/30 text-center">
            <p className="text-red-600 dark:text-red-400 text-xs font-medium uppercase tracking-wide mb-1">
              Precisa sair
            </p>
            <p className="text-red-700 dark:text-red-400 text-xl font-bold">
              {formatCurrency(totalGastos)}
            </p>
          </div>

          {/* Sobra */}
          <div className={`bg-white dark:bg-rv-dark-card rounded-xl p-4 border ${
            saldo >= 0 ? "border-yellow-200 dark:border-yellow-800/30" : "border-red-300 dark:border-red-700/50"
          } text-center`}>
            <p className={`text-xs font-medium uppercase tracking-wide mb-1 ${
              saldo >= 0 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400"
            }`}>
              {saldo >= 0 ? "Sobra" : "Falta"}
            </p>
            <p className={`text-xl font-bold ${
              saldo >= 0 ? "text-yellow-700 dark:text-yellow-400" : "text-red-700 dark:text-red-400"
            }`}>
              {formatCurrency(Math.abs(saldo))}
            </p>
          </div>
        </div>

        {/* Prioridades */}
        <div className="bg-white dark:bg-rv-dark-card rounded-xl p-4 border border-red-100 dark:border-red-900/30 mb-4">
          <h3 className="text-red-700 dark:text-red-400 font-semibold text-sm mb-3 flex items-center gap-2">
            📋 PRIORIDADES AGORA:
          </h3>
          <div className="space-y-2">
            {prioridades.map((p, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 dark:text-gray-300">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{i + 1}.</span>{" "}
                  {p.nome}
                  <span className="text-gray-400 dark:text-gray-500 mx-2">
                    {".".repeat(Math.max(1, 30 - p.nome.length))}
                  </span>
                </span>
                <span className="text-red-600 dark:text-red-400 font-medium">
                  {formatCurrency(p.valor)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Dicas de corte */}
        <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800/30 mb-4">
          <h3 className="text-amber-700 dark:text-amber-400 font-semibold text-sm mb-3 flex items-center gap-2">
            💡 O que cortar primeiro:
          </h3>
          <ul className="space-y-1.5 text-sm text-amber-800 dark:text-amber-300">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-amber-500 dark:bg-amber-400 rounded-full" />
              Lazer e entretenimento
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-amber-500 dark:bg-amber-400 rounded-full" />
              Assinaturas não essenciais
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-amber-500 dark:bg-amber-400 rounded-full" />
              Gastos com alimentação fora de casa
            </li>
          </ul>
        </div>

        {/* Ações */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <button className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-rv-vivid hover:bg-rv-vivid/90 text-white rounded-xl font-medium text-sm transition-colors">
            Ver plano de recuperação completo
            <ArrowRight className="w-4 h-4" />
          </button>
          <button className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium text-sm transition-colors">
            <MessageCircle className="w-4 h-4" />
            Falar com a Viva
          </button>
        </div>

        {/* Desativar modo crise */}
        <div className="border-t border-red-200 dark:border-red-800/30 pt-4">
          {showConfirm ? (
            <div className="flex items-center justify-center gap-3">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Tem certeza?
              </span>
              <button
                onClick={handleDesativar}
                disabled={loading}
                className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? "Desativando..." : "Sim, desativar"}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowConfirm(true)}
              className="w-full text-center text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center justify-center gap-1 transition-colors"
            >
              <X className="w-3 h-3" />
              Desativar modo crise manualmente
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
