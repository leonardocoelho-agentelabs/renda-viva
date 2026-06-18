"use client";

import { useState } from "react";
import { Pencil, Copy, Repeat, Trash2, MoreVertical } from "lucide-react";
import { getCategoryColor } from "@/lib/category-colors";
import { getCategoryIcon } from "@/lib/category-icons";

export interface Transacao {
  id: string;
  data: string;
  valor: number;
  descricao_raw: string;
  categoria: string | null;
  tipo: string;
  status_revisao: string;
  is_recorrente?: boolean;
  registrado_por?: string;
}

interface TransactionRowProps {
  transacao: Transacao;
  onEdit: (t: Transacao) => void;
  onDuplicate: (id: string) => void;
  onToggleRecorrente: (id: string, atual: boolean) => void;
  onDelete: (id: string) => void;
}

export function TransactionRow({
  transacao,
  onEdit,
  onDuplicate,
  onToggleRecorrente,
  onDelete,
}: TransactionRowProps) {
  const [menuAberto, setMenuAberto] = useState(false);
  const cor = getCategoryColor(transacao.categoria);
  const Icon = getCategoryIcon(transacao.categoria);
  const isReceita = transacao.valor > 0;

  const dataFormatada = new Date(transacao.data + "T00:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });

  return (
    <div className="group relative flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
      {/* Ícone da categoria */}
      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${cor.bg}`}>
        <Icon className={`w-5 h-5 ${cor.text}`} />
      </div>

      {/* Informações principais */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-900 dark:text-[#F0F0F0] truncate">{transacao.descricao_raw}</p>
          {transacao.is_recorrente && (
            <Repeat className="w-3 h-3 text-gray-400 dark:text-[#8A8A8A] flex-shrink-0" />
          )}
          {transacao.status_revisao === "revisar" && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 flex-shrink-0">
              Revisar
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-xs px-2 py-0.5 rounded-full ${cor.bg} ${cor.text}`}>
            {transacao.categoria || "Sem categoria"}
          </span>
          <span className="text-xs text-[#8A8A8A]">{dataFormatada}</span>
          {transacao.registrado_por && (
            <span className="text-xs text-[#8A8A8A]">· via WhatsApp ({transacao.registrado_por})</span>
          )}
        </div>
      </div>

      {/* Valor */}
      <div className="flex-shrink-0 text-right">
        <p className={`text-sm font-semibold tabular-nums ${isReceita ? "text-green-600 dark:text-green-400" : "text-gray-900 dark:text-[#F0F0F0]"}`}>
          {isReceita ? "+" : "-"}R$ {Math.abs(transacao.valor).toFixed(2)}
        </p>
      </div>

      {/* Ações rápidas */}
      <div className="flex-shrink-0 relative">
        <button
          onClick={() => setMenuAberto(!menuAberto)}
          aria-label="Ações"
          className="md:opacity-0 md:group-hover:opacity-100 opacity-60 transition-opacity p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-400 hover:text-gray-600 dark:text-[#8A8A8A] dark:hover:text-[#F0F0F0]"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {menuAberto && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuAberto(false)} />
            <div className="absolute right-0 top-9 z-20 bg-white dark:bg-[#1E1E1E] rounded-xl border border-gray-100 dark:border-white/10 shadow-lg py-1 w-48">
              <button
                onClick={() => {
                  onEdit(transacao);
                  setMenuAberto(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-[#F0F0F0] hover:bg-gray-50 dark:hover:bg-white/5 text-left"
              >
                <Pencil className="w-4 h-4 text-gray-400 dark:text-[#8A8A8A]" />
                Editar
              </button>
              <button
                onClick={() => {
                  onDuplicate(transacao.id);
                  setMenuAberto(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-[#F0F0F0] hover:bg-gray-50 dark:hover:bg-white/5 text-left"
              >
                <Copy className="w-4 h-4 text-gray-400 dark:text-[#8A8A8A]" />
                Duplicar
              </button>
              <button
                onClick={() => {
                  onToggleRecorrente(transacao.id, !!transacao.is_recorrente);
                  setMenuAberto(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-[#F0F0F0] hover:bg-gray-50 dark:hover:bg-white/5 text-left"
              >
                <Repeat className="w-4 h-4 text-gray-400 dark:text-[#8A8A8A]" />
                {transacao.is_recorrente ? "Desmarcar recorrente" : "Marcar como recorrente"}
              </button>
              <div className="border-t border-gray-100 dark:border-white/5 my-1" />
              <button
                onClick={() => {
                  onDelete(transacao.id);
                  setMenuAberto(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-left"
              >
                <Trash2 className="w-4 h-4" />
                Excluir
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default TransactionRow;
