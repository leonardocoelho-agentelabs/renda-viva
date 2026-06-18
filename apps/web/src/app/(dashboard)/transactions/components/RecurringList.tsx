"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  MoreHorizontal,
  Calendar,
  CreditCard,
  AlertTriangle,
  X,
  Check,
} from "lucide-react";

export interface RecurringCommitment {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: string;
  tipo: "assinatura" | "parcela";
  valor: number;
  dia_vencimento: number;
  total_parcelas: number | null;
  parcelas_pagas: number;
  parcelas_restantes: number | null;
  data_inicio: string;
  data_fim: string | null;
  status: "ativo" | "cancelado" | "concluido";
  alerta_whatsapp: boolean;
  proxima_cobranca?: string;
  dias_para_vencimento?: number;
  valor_total_restante?: number;
  created_at: string;
}

interface RecurringListProps {
  commitments: RecurringCommitment[];
  onUpdate: () => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  Assinaturas: "📺",
  Alimentação: "🍔",
  Transporte: "🚗",
  Saúde: "🏥",
  Educação: "📚",
  Lazer: "🎮",
  Moradia: "🏠",
  Investimentos: "📈",
  Receita: "💵",
  Outros: "📦",
};

export function RecurringList({ commitments, onUpdate }: RecurringListProps) {
  const router = useRouter();
  const supabase = createClient();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

  const [cancelDialog, setCancelDialog] = useState<RecurringCommitment | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCancel = async (commitment: RecurringCommitment) => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Não autenticado");
      }

      const res = await fetch(`${apiUrl}/recurring/${commitment.id}/cancel`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao cancelar");
      }

      setCancelDialog(null);
      onUpdate();
    } catch (err) {
      console.error("Erro ao cancelar:", err);
      alert(err instanceof Error ? err.message : "Erro ao cancelar compromisso");
    } finally {
      setLoading(false);
    }
  };

  const handlePagar = async (commitment: RecurringCommitment) => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Não autenticado");
      }

      const res = await fetch(`${apiUrl}/recurring/${commitment.id}/pagar`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao registrar pagamento");
      }

      onUpdate();
    } catch (err) {
      console.error("Erro ao pagar:", err);
      alert(err instanceof Error ? err.message : "Erro ao registrar pagamento");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const isVencimentoProximo = (dias?: number) => dias !== undefined && dias <= 3;

  const getIcon = (categoria: string) => CATEGORY_ICONS[categoria] || "📦";

  if (commitments.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-[#8A8A8A]">Nenhum compromisso encontrado</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {commitments.map((commitment) => (
          <div
            key={commitment.id}
            className="bg-white dark:bg-[#1E1E1E] border border-gray-100 dark:border-white/8 rounded-xl p-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{getIcon(commitment.categoria)}</span>
                  <div>
                    <h4 className="font-semibold text-rv-ink dark:text-[#F0F0F0]">
                      {commitment.nome}
                    </h4>
                    <p className="text-xs text-[#8A8A8A]">{commitment.categoria}</p>
                  </div>
                </div>

                {commitment.descricao && (
                  <p className="text-sm text-[#8A8A8A] mt-1">
                    {commitment.descricao}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    commitment.status === "ativo"
                      ? "bg-rv-green/10 text-rv-green"
                      : commitment.status === "concluido"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {commitment.status === "ativo"
                    ? "Ativo"
                    : commitment.status === "concluido"
                    ? "Concluído"
                    : "Cancelado"}
                </span>
              </div>
            </div>

            <div className="mt-3 space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#8A8A8A]">
                  {commitment.tipo === "assinatura" ? (
                    <>
                      <CreditCard className="w-3 h-3 inline mr-1" />
                      Assinatura
                    </>
                  ) : (
                    <>
                      <Calendar className="w-3 h-3 inline mr-1" />
                      Parcela {commitment.parcelas_pagas + 1}/{commitment.total_parcelas}
                    </>
                  )}
                </span>
                <span className="font-semibold text-rv-ink dark:text-[#F0F0F0]">
                  {formatCurrency(commitment.valor)}/mês
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-[#8A8A8A]">Dia de vencimento</span>
                <span className="text-rv-ink dark:text-[#F0F0F0]">
                  Todo dia {commitment.dia_vencimento}
                </span>
              </div>

              {commitment.tipo === "parcela" && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#8A8A8A]">Restam</span>
                    <span className="text-rv-ink dark:text-[#F0F0F0]">
                      {commitment.parcelas_restantes} parcelas ·{" "}
                      {formatCurrency(commitment.valor_total_restante || 0)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#8A8A8A]">Quitação</span>
                    <span className="text-rv-ink dark:text-[#F0F0F0]">
                      {commitment.data_fim
                        ? format(new Date(commitment.data_fim), "MMM yyyy", {
                            locale: ptBR,
                          })
                        : "-"}
                    </span>
                  </div>

                  {/* Barra de progresso */}
                  <div className="w-full bg-rv-mint/10 dark:bg-rv-green/10 rounded-full h-1.5 mt-2">
                    <div
                      className="bg-rv-green dark:bg-rv-vivid h-1.5 rounded-full transition-all"
                      style={{
                        width: `${
                          ((commitment.parcelas_pagas || 0) /
                            (commitment.total_parcelas || 1)) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                </>
              )}
            </div>

            {isVencimentoProximo(commitment.dias_para_vencimento) && (
              <div className="mt-3 flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-3 py-1.5 rounded-lg text-sm">
                <AlertTriangle className="w-4 h-4" />
                Vence em {commitment.dias_para_vencimento} dias
                {commitment.proxima_cobranca && (
                  <span className="ml-auto">
                    ({format(new Date(commitment.proxima_cobranca), "dd/MM")})
                  </span>
                )}
              </div>
            )}

            <div className="mt-3 flex items-center justify-end gap-2">
              {commitment.tipo === "parcela" &&
                commitment.status === "ativo" &&
                (commitment.parcelas_restantes || 0) > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePagar(commitment)}
                    disabled={loading}
                    className="border-rv-green/20 text-rv-green hover:bg-rv-green/10"
                  >
                    <Check className="w-3 h-3 mr-1" />
                    Pagar próxima
                  </Button>
                )}

              {commitment.tipo === "assinatura" && commitment.status === "ativo" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCancelDialog(commitment)}
                  className="border-red-200 text-red-600 hover:bg-red-50"
                >
                  <X className="w-3 h-3 mr-1" />
                  Cancelar
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Dialog de confirmação de cancelamento */}
      <AlertDialog open={!!cancelDialog} onOpenChange={() => setCancelDialog(null)}>
        <AlertDialogContent className="bg-white dark:bg-[#1E1E1E]">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar assinatura</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar <strong>{cancelDialog?.nome}</strong>?
              <br />
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelDialog && handleCancel(cancelDialog)}
              className="bg-red-600 hover:bg-red-700"
            >
              Confirmar cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
