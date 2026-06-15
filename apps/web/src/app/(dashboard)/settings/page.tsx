"use client";

import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { MessageCircle, Plus, Trash2, Check, AlertCircle } from "lucide-react";

interface Contato {
  id: string;
  telefone: string;
  nome: string;
  created_at?: string;
}

function formatarTelefoneMascarado(telefone: string | null): string {
  if (!telefone) return "";
  const digits = telefone.replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return telefone;
}

export default function SettingsPage() {
  const supabase = createClient();
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [novoNome, setNovoNome] = useState("");
  const [novoTelefone, setNovoTelefone] = useState("");
  const [adicionando, setAdicionando] = useState(false);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

  const getToken = useCallback(async (): Promise<string | null> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, [supabase]);

  const carregarContatos = useCallback(async () => {
    setLoading(true);
    setErro("");
    try {
      const token = await getToken();
      if (!token) {
        setErro("Sessão expirada. Faça login novamente.");
        return;
      }
      const res = await fetch(`${apiUrl}/whatsapp-contacts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const data = await res.json();
      setContatos(data.contatos || []);
    } catch {
      setErro("Não foi possível carregar os contatos.");
    } finally {
      setLoading(false);
    }
  }, [apiUrl, getToken]);

  useEffect(() => {
    carregarContatos();
  }, [carregarContatos]);

  const adicionarContato = async () => {
    setErro("");
    if (!novoNome.trim() || !novoTelefone.trim()) {
      setErro("Preencha nome e telefone");
      return;
    }

    setSaving(true);
    try {
      const token = await getToken();
      if (!token) {
        setErro("Sessão expirada. Faça login novamente.");
        return;
      }

      const res = await fetch(`${apiUrl}/whatsapp-contacts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ telefone: novoTelefone, nome: novoNome }),
      });

      if (!res.ok) {
        const json = await res.json();
        setErro(json.error || "Erro ao adicionar número");
        return;
      }

      setNovoNome("");
      setNovoTelefone("");
      setAdicionando(false);
      carregarContatos();
    } catch {
      setErro("Erro ao adicionar número");
    } finally {
      setSaving(false);
    }
  };

  const removerContato = async (id: string) => {
    try {
      const token = await getToken();
      if (!token) return;

      await fetch(`${apiUrl}/whatsapp-contacts/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      carregarContatos();
    } catch {
      setErro("Erro ao remover contato");
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-[#F8FAFC]">Configurações</h1>
        <p className="text-gray-500 dark:text-[#94A3B8]">Gerencie suas preferências e integrações</p>
      </div>

      {erro && (
        <div className="mb-6 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {erro}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="h-10 w-10 rounded-full border-2 border-green-500 border-t-transparent animate-spin mb-4" />
          <p className="text-gray-400">Carregando...</p>
        </div>
      ) : (
        <div className="space-y-6 max-w-2xl">
          {/* Card WhatsApp */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] p-6 dark:bg-[#111827] dark:border-[#1E293B]">
            <div className="flex items-center gap-2 mb-1">
              <MessageCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-[#F8FAFC]">Números vinculados ao WhatsApp</h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-[#94A3B8] mb-4">
              Qualquer pessoa da família pode registrar transações pelo WhatsApp enviando
              mensagens de texto ou áudio para o número do Renda Viva. Adicione os números
              de quem você confia.
            </p>

            <div className="space-y-2 mb-4">
              {contatos.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-[#1E293B]">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-[#F8FAFC]">{c.nome}</p>
                    <p className="text-xs text-gray-500 dark:text-[#94A3B8]">{formatarTelefoneMascarado(c.telefone)}</p>
                  </div>
                  <button
                    onClick={() => removerContato(c.id)}
                    className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {contatos.length === 0 && (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">Nenhum número vinculado ainda</p>
              )}
            </div>

            {adicionando ? (
              <div className="space-y-3 p-3 rounded-xl border border-gray-200 dark:border-[#1E293B]">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Nome/apelido</label>
                  <input
                    type="text"
                    value={novoNome}
                    onChange={(e) => setNovoNome(e.target.value)}
                    placeholder="Ex: Maria"
                    className="w-full border border-gray-300 dark:border-[#374151] rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-[#F8FAFC] placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white dark:bg-[#1E293B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Número do WhatsApp</label>
                  <input
                    type="text"
                    value={novoTelefone}
                    onChange={(e) => setNovoTelefone(e.target.value.replace(/\D/g, ""))}
                    placeholder="11999998888"
                    maxLength={11}
                    className="w-full border border-gray-300 dark:border-[#374151] rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-[#F8FAFC] placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white dark:bg-[#1E293B]"
                  />
                </div>
                {erro && <p className="text-xs text-red-600 dark:text-red-400">{erro}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setAdicionando(false);
                      setErro("");
                    }}
                    className="flex-1 border border-gray-200 dark:border-[#374151] text-gray-600 dark:text-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-[#1E293B]"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={adicionarContato}
                    disabled={saving}
                    className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    {saving ? "Adicionando..." : "Adicionar"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAdicionando(true)}
                className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 dark:border-[#374151] rounded-xl py-3 text-sm font-medium text-gray-500 dark:text-gray-400 hover:border-green-400 hover:text-green-600 dark:hover:border-green-400 dark:hover:text-green-400 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Adicionar número
              </button>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
