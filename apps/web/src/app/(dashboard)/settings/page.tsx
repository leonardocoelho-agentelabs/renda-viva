"use client";

import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { createClient } from "@/lib/supabase/client";
import { MessageCircle, Plus, Trash2, AlertCircle } from "lucide-react";

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

  // Conta - senha
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [novoEmail, setNovoEmail] = useState("");
  const [mensagemConta, setMensagemConta] = useState("");

  // Reset transações
  const [confirmandoReset, setConfirmandoReset] = useState(false);
  const [textoConfirmacao, setTextoConfirmacao] = useState("");
  const [resetando, setResetando] = useState(false);

  // Excluir conta
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [textoExclusao, setTextoExclusao] = useState("");
  const [excluindo, setExcluindo] = useState(false);

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

  // Alterar senha
  const alterarSenha = async () => {
    setMensagemConta("");
    if (novaSenha.length < 6) {
      setMensagemConta("A senha deve ter no mínimo 6 caracteres");
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setMensagemConta("As senhas não coincidem");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    if (error) {
      setMensagemConta("Erro ao alterar senha: " + error.message);
    } else {
      setMensagemConta("Senha alterada com sucesso!");
      setNovaSenha("");
      setConfirmarSenha("");
    }
  };

  // Alterar email
  const alterarEmail = async () => {
    setMensagemConta("");
    if (!novoEmail.includes("@")) {
      setMensagemConta("Email inválido");
      return;
    }

    const { error } = await supabase.auth.updateUser({ email: novoEmail });
    if (error) {
      setMensagemConta("Erro ao alterar email: " + error.message);
    } else {
      setMensagemConta("Enviamos um link de confirmação para o novo email. Confirme para concluir a alteração.");
      setNovoEmail("");
    }
  };

  // Resetar transações
  const resetarTransacoes = async () => {
    if (textoConfirmacao !== "EXCLUIR") return;

    setResetando(true);
    const token = await getToken();
    if (!token) {
      setResetando(false);
      return;
    }

    await fetch(`${apiUrl}/transactions/reset`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    setResetando(false);
    setConfirmandoReset(false);
    setTextoConfirmacao("");
    window.location.href = "/dashboard";
  };

  // Excluir conta
  const excluirConta = async () => {
    if (textoExclusao !== "EXCLUIR MINHA CONTA") return;

    setExcluindo(true);
    const token = await getToken();
    if (!token) {
      setExcluindo(false);
      return;
    }

    await fetch(`${apiUrl}/users/me`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    await supabase.auth.signOut();
    window.location.href = "/";
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
          {/* Card Conta */}
          <div className="bg-white dark:bg-rv-dark-card rounded-2xl border border-rv-forest/10 dark:border-rv-light/10 shadow-sm p-6 space-y-6">
            <h3 className="text-sm font-semibold text-rv-ink dark:text-rv-dark-ink">Conta</h3>

            <div>
              <label className="block text-xs font-medium text-rv-ink dark:text-rv-dark-ink mb-2">Alterar senha</label>
              <div className="space-y-2">
                <input
                  type="password"
                  placeholder="Nova senha"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  className="w-full border border-rv-forest/10 dark:border-rv-light/10 dark:bg-rv-dark-card rounded-lg px-3 py-2 text-sm text-rv-ink dark:text-rv-dark-ink placeholder:text-rv-muted/70"
                />
                <input
                  type="password"
                  placeholder="Confirmar nova senha"
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  className="w-full border border-rv-forest/10 dark:border-rv-light/10 dark:bg-rv-dark-card rounded-lg px-3 py-2 text-sm text-rv-ink dark:text-rv-dark-ink placeholder:text-rv-muted/70"
                />
                <button
                  onClick={alterarSenha}
                  className="text-sm bg-rv-forest dark:bg-rv-dark-card text-white rounded-lg px-4 py-2 hover:bg-rv-green dark:hover:bg-rv-dark-active-bg"
                >
                  Alterar senha
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-rv-forest/10 dark:border-rv-light/10">
              <label className="block text-xs font-medium text-rv-ink dark:text-rv-dark-ink mb-2">Alterar email</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="novo@email.com"
                  value={novoEmail}
                  onChange={(e) => setNovoEmail(e.target.value)}
                  className="flex-1 border border-rv-forest/10 dark:border-rv-light/10 dark:bg-rv-dark-card rounded-lg px-3 py-2 text-sm text-rv-ink dark:text-rv-dark-ink placeholder:text-rv-muted/70"
                />
                <button
                  onClick={alterarEmail}
                  className="text-sm bg-rv-forest dark:bg-rv-dark-card text-white rounded-lg px-4 py-2 whitespace-nowrap hover:bg-rv-green dark:hover:bg-rv-dark-active-bg"
                >
                  Alterar email
                </button>
              </div>
            </div>

            {mensagemConta && (
              <p className="text-sm text-rv-muted dark:text-rv-dark-muted">{mensagemConta}</p>
            )}
          </div>

          {/* Card WhatsApp */}
          <div className="bg-white dark:bg-rv-dark-card rounded-2xl border border-rv-forest/10 dark:border-rv-light/10 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-1">
              <MessageCircle className="w-4 h-4 text-rv-green dark:text-rv-vivid" />
              <h3 className="text-sm font-semibold text-rv-ink dark:text-rv-dark-ink">Números vinculados ao WhatsApp</h3>
            </div>
            <p className="text-xs text-rv-muted dark:text-rv-dark-muted mb-4">
              Qualquer pessoa da família pode registrar transações pelo WhatsApp enviando
              mensagens de texto ou áudio para o número do Renda Viva. Adicione os números
              de quem você confia.
            </p>

            <div className="space-y-2 mb-4">
              {contatos.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-xl bg-rv-mint/30 dark:bg-rv-dark-active-bg">
                  <div>
                    <p className="text-sm font-medium text-rv-ink dark:text-rv-dark-ink">{c.nome}</p>
                    <p className="text-xs text-rv-muted dark:text-rv-dark-muted">{formatarTelefoneMascarado(c.telefone)}</p>
                  </div>
                  <button
                    onClick={() => removerContato(c.id)}
                    className="text-rv-muted/70 hover:text-red-500 dark:text-rv-dark-muted dark:hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {contatos.length === 0 && (
                <p className="text-sm text-rv-muted dark:text-rv-dark-muted text-center py-4">Nenhum número vinculado ainda</p>
              )}
            </div>

            {adicionando ? (
              <div className="space-y-3 p-3 rounded-xl border border-rv-forest/10 dark:border-rv-light/10">
                <div>
                  <label className="block text-xs font-medium text-rv-ink dark:text-rv-dark-ink mb-1">Nome/apelido</label>
                  <input
                    type="text"
                    value={novoNome}
                    onChange={(e) => setNovoNome(e.target.value)}
                    placeholder="Ex: Maria"
                    className="w-full border border-rv-forest/10 dark:border-rv-light/10 rounded-lg px-3 py-2 text-sm text-rv-ink dark:text-rv-dark-ink placeholder:text-rv-muted/70 focus:outline-none focus:ring-2 focus:ring-rv-green bg-white dark:bg-rv-dark-card"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-rv-ink dark:text-rv-dark-ink mb-1">Número do WhatsApp</label>
                  <input
                    type="text"
                    value={novoTelefone}
                    onChange={(e) => setNovoTelefone(e.target.value.replace(/\D/g, ""))}
                    placeholder="11999998888"
                    maxLength={11}
                    className="w-full border border-rv-forest/10 dark:border-rv-light/10 rounded-lg px-3 py-2 text-sm text-rv-ink dark:text-rv-dark-ink placeholder:text-rv-muted/70 focus:outline-none focus:ring-2 focus:ring-rv-green bg-white dark:bg-rv-dark-card"
                  />
                </div>
                {erro && <p className="text-xs text-red-500 dark:text-red-400">{erro}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setAdicionando(false);
                      setErro("");
                    }}
                    className="flex-1 border border-rv-forest/10 dark:border-rv-light/10 text-rv-muted dark:text-rv-dark-muted rounded-lg py-2 text-sm font-medium hover:bg-rv-mint/30 dark:hover:bg-rv-dark-card"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={adicionarContato}
                    disabled={saving}
                    className="flex-1 bg-rv-green dark:bg-rv-vivid text-white rounded-lg py-2 text-sm font-medium hover:bg-rv-forest dark:hover:bg-rv-vivid/90 disabled:opacity-50"
                  >
                    {saving ? "Adicionando..." : "Adicionar"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAdicionando(true)}
                className="w-full flex items-center justify-center gap-2 border border-dashed border-rv-forest/20 dark:border-rv-light/20 rounded-xl py-3 text-sm font-medium text-rv-muted dark:text-rv-dark-muted hover:border-rv-green hover:text-rv-green dark:hover:border-rv-vivid dark:hover:text-rv-vivid transition-colors"
              >
                <Plus className="w-4 h-4" />
                Adicionar número
              </button>
            )}
          </div>

          {/* Zona de Perigo */}
          <div className="bg-white dark:bg-[#111827] rounded-2xl border border-red-100 dark:border-red-900/30 p-6 space-y-4">
            <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-1">Zona de perigo</h3>
            <p className="text-xs text-gray-500 dark:text-[#94A3B8]">
              Ações abaixo são irreversíveis. Tenha certeza antes de continuar.
            </p>

            {/* Resetar transações */}
            {!confirmandoReset ? (
              <button
                onClick={() => setConfirmandoReset(true)}
                className="text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-lg px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/10"
              >
                Resetar todas as transações
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Isso vai excluir TODAS as suas transações permanentemente. Digite{" "}
                  <strong>EXCLUIR</strong> para confirmar.
                </p>
                <input
                  type="text"
                  value={textoConfirmacao}
                  onChange={(e) => setTextoConfirmacao(e.target.value)}
                  placeholder="Digite EXCLUIR"
                  className="border border-gray-300 dark:border-[#1E293B] dark:bg-[#0F172A] rounded-lg px-3 py-2 text-sm w-full max-w-xs text-gray-900 dark:text-[#F8FAFC]"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setConfirmandoReset(false);
                      setTextoConfirmacao("");
                    }}
                    className="text-sm text-gray-500 dark:text-gray-400 px-4 py-2 hover:bg-gray-100 dark:hover:bg-[#1E293B] rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={resetarTransacoes}
                    disabled={textoConfirmacao !== "EXCLUIR" || resetando}
                    className="text-sm bg-red-600 text-white rounded-lg px-4 py-2 disabled:opacity-40 hover:bg-red-700"
                  >
                    {resetando ? "Resetando..." : "Confirmar reset"}
                  </button>
                </div>
              </div>
            )}

            <div className="border-t border-red-100 dark:border-red-900/20 pt-4">
              {/* Excluir conta */}
              {!confirmandoExclusao ? (
                <button
                  onClick={() => setConfirmandoExclusao(true)}
                  className="text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-lg px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/10"
                >
                  Excluir minha conta
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    Isso excluirá permanentemente sua conta, todas as transações, metas,
                    assinatura e dados associados. Não pode ser desfeito.
                  </p>
                  <input
                    type="text"
                    value={textoExclusao}
                    onChange={(e) => setTextoExclusao(e.target.value)}
                    placeholder="Digite EXCLUIR MINHA CONTA"
                    className="border border-gray-300 dark:border-[#1E293B] dark:bg-[#0F172A] rounded-lg px-3 py-2 text-sm w-full max-w-xs text-gray-900 dark:text-[#F8FAFC]"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setConfirmandoExclusao(false);
                        setTextoExclusao("");
                      }}
                      className="text-sm text-gray-500 dark:text-gray-400 px-4 py-2 hover:bg-gray-100 dark:hover:bg-[#1E293B] rounded-lg"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={excluirConta}
                      disabled={textoExclusao !== "EXCLUIR MINHA CONTA" || excluindo}
                      className="text-sm bg-red-600 text-white rounded-lg px-4 py-2 disabled:opacity-40 hover:bg-red-700"
                    >
                      {excluindo ? "Excluindo..." : "Confirmar exclusão"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
