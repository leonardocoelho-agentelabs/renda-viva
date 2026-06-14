"use client";

import { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  transacao?: {
    id: string;
    data: string;
    valor: number;
    descricao_raw: string;
    categoria: string | null;
    tipo: string;
  } | null;
}

export function TransactionModal({ isOpen, onClose, onSuccess, transacao }: TransactionModalProps) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
  const supabase = createClient();

  const [data, setData] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [tipoTransacao, setTipoTransacao] = useState<"despesa" | "receita">("despesa");
  const [categoria, setCategoria] = useState("");
  const [categorias, setCategorias] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const isEdicao = !!transacao;

  const carregarCategorias = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    const res = await fetch(`${apiUrl}/transactions/categories`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return;
    const json = await res.json();
    setCategorias(json.categorias || []);
  }, [apiUrl, supabase]);

  useEffect(() => {
    if (!isOpen) return;
    carregarCategorias();
    if (transacao) {
      setData(transacao.data);
      setDescricao(transacao.descricao_raw);
      setValor(Math.abs(transacao.valor).toString());
      setTipoTransacao(transacao.valor < 0 ? "despesa" : "receita");
      setCategoria(transacao.categoria || "");
    } else {
      setData(new Date().toISOString().split("T")[0]);
      setDescricao("");
      setValor("");
      setTipoTransacao("despesa");
      setCategoria("");
    }
    setErro("");
  }, [isOpen, transacao, carregarCategorias]);

  const handleSubmit = async () => {
    if (!data || !descricao || !valor || !categoria) {
      setErro("Preencha todos os campos");
      return;
    }

    setLoading(true);
    setErro("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setErro("Sessão expirada. Faça login novamente.");
        return;
      }

      const payload = {
        data,
        descricao_raw: descricao,
        valor: parseFloat(valor.replace(",", ".")),
        categoria,
        tipo: tipoTransacao,
      };

      const url = isEdicao
        ? `${apiUrl}/transactions/${transacao!.id}`
        : `${apiUrl}/transactions`;

      const response = await fetch(url, {
        method: isEdicao ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Erro ao salvar transação");
      }

      onSuccess();
      onClose();
    } catch {
      setErro("Não foi possível salvar a transação. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdicao ? "Editar Transação" : "Nova Transação"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toggle Despesa/Receita */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTipoTransacao("despesa")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
              tipoTransacao === "despesa"
                ? "bg-red-50 border-red-200 text-red-700"
                : "bg-white border-gray-200 text-gray-500"
            }`}
          >
            💸 Despesa
          </button>
          <button
            onClick={() => setTipoTransacao("receita")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
              tipoTransacao === "receita"
                ? "bg-green-50 border-green-200 text-green-700"
                : "bg-white border-gray-200 text-gray-500"
            }`}
          >
            💰 Receita
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
            <input
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Fardo de cerveja na adega"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
            <input
              type="text"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">Selecione...</option>
              {categorias.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {erro && <p className="text-sm text-red-600">{erro}</p>}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Salvando..." : isEdicao ? "Salvar alterações" : "Adicionar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default TransactionModal;
