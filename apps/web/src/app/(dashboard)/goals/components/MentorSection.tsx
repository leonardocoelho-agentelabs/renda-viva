"use client";

import { useState, useEffect } from "react";
import { Target, Plus, X, Sparkles, Trash2, CheckCircle, MessageCircle, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
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

interface MentorObjective {
  id: string;
  objetivo: string;
  valor_alvo: number | null;
  prazo: string | null;
  ativo: boolean;
  progresso_atual: number;
  ultimo_alerta: string | null;
  ultimo_alerta_em: string | null;
}

interface MentorSectionProps {
  refreshTrigger?: number;
}

export function MentorSection({ refreshTrigger }: MentorSectionProps) {
  const supabase = createClient();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

  const [objectives, setObjectives] = useState<MentorObjective[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ objetivo: "", valor_alvo: "" });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [running, setRunning] = useState(false);
  const [runMessage, setRunMessage] = useState<string | null>(null);

  const getToken = async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  };

  const loadObjectives = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${apiUrl}/mentor/objectives`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setObjectives(data.objectives || []);
      }
    } catch (err) {
      console.error("Erro ao carregar objetivos do mentor:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadObjectives();
  }, [refreshTrigger]);

  const handleCreate = async () => {
    if (!form.objetivo.trim()) return;
    setCreating(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${apiUrl}/mentor/objectives`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          objetivo: form.objetivo.trim(),
          valor_alvo: form.valor_alvo ? parseFloat(form.valor_alvo) : undefined,
        }),
      });
      if (res.ok) {
        await loadObjectives();
        setShowCreate(false);
        setForm({ objetivo: "", valor_alvo: "" });
      }
    } catch (err) {
      console.error("Erro ao criar objetivo:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${apiUrl}/mentor/objectives/${deleteId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setObjectives((prev) => prev.filter((o) => o.id !== deleteId));
      }
    } catch (err) {
      console.error("Erro ao deletar objetivo:", err);
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const handleRunNow = async () => {
    setRunning(true);
    setRunMessage(null);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${apiUrl}/mentor/run`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setRunMessage("Alerta enviado! ✅");
        await loadObjectives();
        setTimeout(() => setRunMessage(null), 3000);
      }
    } catch (err) {
      console.error("Erro ao executar mentor:", err);
      setRunMessage("Erro ao enviar alerta");
      setTimeout(() => setRunMessage(null), 3000);
    } finally {
      setRunning(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

  const formatDate = (date: string | null) => {
    if (!date) return null;
    return new Date(date + "T00:00:00").toLocaleDateString("pt-BR");
  };

  return (
    <>
      <div className="bg-gradient-to-r from-rv-vivid/10 to-purple-500/10 dark:from-rv-vivid/20 dark:to-purple-500/20 border border-rv-vivid/20 dark:border-rv-vivid/30 rounded-2xl p-5 mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-rv-vivid/20 dark:bg-rv-vivid/30 rounded-xl flex items-center justify-center">
              <Target className="w-5 h-5 text-rv-vivid" />
            </div>
            <div>
              <h2 className="font-semibold text-rv-ink dark:text-[#F0F0F0] flex items-center gap-2">
                Modo Mentor
                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-rv-vivid/20 text-rv-vivid">
                  Beta
                </span>
              </h2>
              <p className="text-xs text-[#8A8A8A]">
                Defina objetivos e receba alertas proativos
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rv-vivid hover:bg-rv-vivid/90 text-white rounded-lg text-xs font-medium transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Ativar
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-4">
            <div className="h-5 w-5 rounded-full border-2 border-rv-vivid border-t-transparent animate-spin" />
          </div>
        ) : objectives.length === 0 ? (
          <p className="text-sm text-[#8A8A8A] text-center py-2">
            Nenhum objetivo ativo. Clique em &quot;Ativar&quot; para começar.
          </p>
        ) : (
          <div className="space-y-3">
            {objectives.map((obj) => (
              <div
                key={obj.id}
                className="bg-white dark:bg-[#1E1E1E] rounded-xl p-4 border border-white/10 dark:border-white/10"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1">
                    <h3 className="font-medium text-rv-ink dark:text-[#F0F0F0] text-sm">
                      {obj.objetivo}
                    </h3>
                    {obj.valor_alvo && (
                      <p className="text-xs text-[#8A8A8A]">
                        Alvo: {formatCurrency(obj.valor_alvo)}
                        {obj.prazo && ` • Prazo: ${formatDate(obj.prazo)}`}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setDeleteId(obj.id)}
                    className="p-1 text-[#8A8A8A] hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {obj.valor_alvo && (
                  <div className="mb-2">
                    <div className="h-2 w-full bg-[#2A2A2A] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-rv-vivid rounded-full transition-all"
                        style={{ width: `${Math.min(obj.progresso_atual || 0, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-[#8A8A8A] mt-1">
                      Progresso: {(obj.progresso_atual || 0).toFixed(0)}%
                    </p>
                  </div>
                )}

                {obj.ultimo_alerta && (
                  <div className="flex items-start gap-2 text-xs bg-rv-vivid/10 dark:bg-rv-vivid/20 rounded-lg p-2">
                    <MessageCircle className="h-3.5 w-3.5 text-rv-vivid flex-shrink-0 mt-0.5" />
                    <p className="text-rv-ink dark:text-[#F0F0F0]/80">
                      {obj.ultimo_alerta}
                    </p>
                  </div>
                )}
              </div>
            ))}

            <div className="flex items-center justify-between pt-2">
              {runMessage ? (
                <span className="text-xs text-rv-vivid">{runMessage}</span>
              ) : (
                <span className="text-xs text-[#8A8A8A]">
                  Último alerta:{" "}
                  {objectives[0]?.ultimo_alerta_em
                    ? formatDate(objectives[0].ultimo_alerta_em)
                    : "nunca"}
                </span>
              )}
              <button
                onClick={handleRunNow}
                disabled={running}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rv-vivid hover:bg-rv-vivid/10 rounded-lg transition-colors disabled:opacity-50"
              >
                <Send className="h-3 w-3" />
                {running ? "Enviando..." : "Enviar alerta agora"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal criar objetivo */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white dark:bg-[#1E1E1E] rounded-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-lg text-rv-ink dark:text-[#F0F0F0]">
                  Criar Objetivo do Mentor
                </h2>
                <button
                  onClick={() => setShowCreate(false)}
                  className="p-1 text-[#8A8A8A] hover:text-rv-ink dark:hover:text-[#F0F0F0]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-rv-ink dark:text-[#F0F0F0] mb-1">
                    Qual é o seu objetivo?
                  </label>
                  <input
                    type="text"
                    value={form.objetivo}
                    onChange={(e) => setForm({ ...form, objetivo: e.target.value })}
                    placeholder="Ex: Juntar R$ 100.000"
                    className="w-full px-3 py-2 border border-white/10 dark:border-white/10 rounded-lg text-sm dark:bg-[#2A2A2A] dark:text-[#F0F0F0] focus:outline-none focus:ring-2 focus:ring-rv-vivid"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-rv-ink dark:text-[#F0F0F0] mb-1">
                    Valor alvo (opcional)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.valor_alvo}
                    onChange={(e) => setForm({ ...form, valor_alvo: e.target.value })}
                    placeholder="Ex: 100000"
                    className="w-full px-3 py-2 border border-white/10 dark:border-white/10 rounded-lg text-sm dark:bg-[#2A2A2A] dark:text-[#F0F0F0] focus:outline-none focus:ring-2 focus:ring-rv-vivid"
                  />
                </div>
              </div>

              <button
                onClick={handleCreate}
                disabled={creating || !form.objetivo.trim()}
                className="w-full mt-6 py-2.5 rounded-lg bg-rv-vivid text-white text-sm font-medium hover:bg-rv-vivid/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {creating ? "Criando..." : "Criar Objetivo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AlertDialog de confirmação para excluir */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="bg-white dark:bg-[#1E1E1E]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-rv-ink dark:text-[#F0F0F0]">
              Remover objetivo
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#8A8A8A]">
              Tem certeza que deseja remover este objetivo do mentor?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-200 dark:border-white/10">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Removendo..." : "Sim, remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
