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
          <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-white/8 shadow-sm p-6 space-y-6">
            <h3 className="text-sm font-semibold text-rv-ink dark:text-[#F0F0F0]">Conta</h3>

            <div>
              <label className="block text-xs font-medium text-rv-ink dark:text-[#F0F0F0] mb-2">Alterar senha</label>
              <div className="space-y-2">
                <input
                  type="password"
                  placeholder="Nova senha"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  className="w-full border border-white/10 dark:border-white/10 dark:bg-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-rv-ink dark:text-[#F0F0F0] placeholder:text-rv-muted/70 dark:placeholder:text-[#8A8A8A]"
                />
                <input
                  type="password"
                  placeholder="Confirmar nova senha"
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  className="w-full border border-white/10 dark:border-white/10 dark:bg-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-rv-ink dark:text-[#F0F0F0] placeholder:text-rv-muted/70 dark:placeholder:text-[#8A8A8A]"
                />
                <button
                  onClick={alterarSenha}
                  className="text-sm bg-rv-forest dark:bg-[#1E1E1E] text-white rounded-lg px-4 py-2 hover:bg-rv-green dark:hover:bg-white/10"
                >
                  Alterar senha
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-white/5">
              <label className="block text-xs font-medium text-rv-ink dark:text-[#F0F0F0] mb-2">Alterar email</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="novo@email.com"
                  value={novoEmail}
                  onChange={(e) => setNovoEmail(e.target.value)}
                  className="flex-1 border border-white/10 dark:border-white/10 dark:bg-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-rv-ink dark:text-[#F0F0F0] placeholder:text-rv-muted/70 dark:placeholder:text-[#8A8A8A]"
                />
                <button
                  onClick={alterarEmail}
                  className="text-sm bg-rv-forest dark:bg-[#1E1E1E] text-white rounded-lg px-4 py-2 whitespace-nowrap hover:bg-rv-green dark:hover:bg-white/10"
                >
                  Alterar email
                </button>
              </div>
            </div>

            {mensagemConta && (
              <p className="text-sm text-[#8A8A8A]">{mensagemConta}</p>
            )}
          </div>

          {/* Card WhatsApp */}
          <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-white/8 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-1">
              <MessageCircle className="w-4 h-4 text-rv-green dark:text-rv-vivid" />
              <h3 className="text-sm font-semibold text-rv-ink dark:text-[#F0F0F0]">Números vinculados ao WhatsApp</h3>
            </div>
            <p className="text-xs text-[#8A8A8A] mb-4">
              Qualquer pessoa da família pode registrar transações pelo WhatsApp enviando
              mensagens de texto ou áudio para o número do Renda Viva. Adicione os números
              de quem você confia.
            </p>

            <div className="space-y-2 mb-4">
              {contatos.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-xl bg-rv-mint/30 dark:bg-white/5">
                  <div>
                    <p className="text-sm font-medium text-rv-ink dark:text-[#F0F0F0]">{c.nome}</p>
                    <p className="text-xs text-[#8A8A8A]">{formatarTelefoneMascarado(c.telefone)}</p>
                  </div>
                  <button
                    onClick={() => removerContato(c.id)}
                    className="text-rv-muted/70 hover:text-red-500 dark:text-[#8A8A8A] dark:hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {contatos.length === 0 && (
                <p className="text-sm text-[#8A8A8A] text-center py-4">Nenhum número vinculado ainda</p>
              )}
            </div>

            {adicionando ? (
              <div className="space-y-3 p-3 rounded-xl border border-white/10">
                <div>
                  <label className="block text-xs font-medium text-rv-ink dark:text-[#F0F0F0] mb-1">Nome/apelido</label>
                  <input
                    type="text"
                    value={novoNome}
                    onChange={(e) => setNovoNome(e.target.value)}
                    placeholder="Ex: Maria"
                    className="w-full border border-white/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-rv-ink dark:text-[#F0F0F0] placeholder:text-rv-muted/70 dark:placeholder:text-[#8A8A8A] focus:outline-none focus:ring-2 focus:ring-rv-green bg-white dark:bg-[#2A2A2A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-rv-ink dark:text-[#F0F0F0] mb-1">Número do WhatsApp</label>
                  <input
                    type="text"
                    value={novoTelefone}
                    onChange={(e) => setNovoTelefone(e.target.value.replace(/\D/g, ""))}
                    placeholder="11999998888"
                    maxLength={11}
                    className="w-full border border-white/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-rv-ink dark:text-[#F0F0F0] placeholder:text-rv-muted/70 dark:placeholder:text-[#8A8A8A] focus:outline-none focus:ring-2 focus:ring-rv-green bg-white dark:bg-[#2A2A2A]"
                  />
                </div>
                {erro && <p className="text-xs text-red-500 dark:text-red-400">{erro}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setAdicionando(false);
                      setErro("");
                    }}
                    className="flex-1 border border-white/10 text-[#8A8A8A] rounded-lg py-2 text-sm font-medium hover:bg-white/5 dark:hover:bg-white/5"
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
                className="w-full flex items-center justify-center gap-2 border border-dashed border-rv-forest/20 dark:border-white/10 rounded-xl py-3 text-sm font-medium text-[#8A8A8A] hover:border-rv-green hover:text-rv-green dark:hover:border-rv-vivid dark:hover:text-rv-vivid transition-colors"
              >
                <Plus className="w-4 h-4" />
                Adicionar número
              </button>
            )}
          </div>

          {/* Seção Suporte */}
          <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-rv-forest/10 dark:border-white/8 p-6">
            <div className="flex items-center gap-2 mb-1">
              <MessageCircle className="w-4 h-4 text-rv-green dark:text-rv-vivid" />
              <h3 className="text-sm font-semibold text-rv-ink dark:text-[#F0F0F0]">Suporte</h3>
            </div>
            <p className="text-xs text-[#8A8A8A] mb-4">
              Precisa de ajuda? Fale com a nossa equipe.
            </p>

            {/* Cards de contato */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card 1 - Suporte Geral */}
              <div className="bg-rv-mint/40 dark:bg-rv-green/10 border border-rv-forest/10 dark:border-white/8 rounded-xl p-5">
                <svg viewBox="0 0 24 24" fill="#25D366" width="24" height="24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15
                  -.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475
                  -.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52
                  .149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207
                  -.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372
                  -.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2
                  5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085
                  1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m
                  -5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648
                  -.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0
                  5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885
                  9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0
                  2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005
                  c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
                <h4 className="font-poppins font-semibold text-rv-ink dark:text-rv-dark-ink mt-3">
                  Suporte Geral
                </h4>
                <p className="text-sm text-rv-muted dark:text-rv-dark-muted mt-1">
                  Dúvidas sobre o sistema, categorias ou relatórios.
                </p>
                <p className="text-sm font-semibold text-rv-forest dark:text-rv-vivid mt-3">
                  (11) 95147-4246
                </p>
                <a
                  href="https://wa.me/5511951474246?text=Olá!%20Preciso%20de%20ajuda%20com%20o%20Renda%20Viva."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full mt-3 inline-block text-center bg-rv-green hover:bg-rv-forest dark:bg-rv-vivid dark:hover:bg-rv-green text-white font-poppins font-semibold rounded-xl py-2.5 text-sm transition-colors"
                >
                  Chamar no WhatsApp
                </a>
              </div>

              {/* Card 2 - Suporte Técnico */}
              <div className="bg-rv-mint/40 dark:bg-rv-green/10 border border-rv-forest/10 dark:border-white/8 rounded-xl p-5">
                <svg viewBox="0 0 24 24" fill="#25D366" width="24" height="24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15
                  -.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475
                  -.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52
                  .149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207
                  -.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372
                  -.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2
                  5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085
                  1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m
                  -5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648
                  -.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0
                  5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885
                  9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0
                  2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005
                  c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
                <h4 className="font-poppins font-semibold text-rv-ink dark:text-rv-dark-ink mt-3">
                  Suporte Técnico
                </h4>
                <p className="text-sm text-rv-muted dark:text-rv-dark-muted mt-1">
                  Problemas de acesso, pagamento ou dados da conta.
                </p>
                <p className="text-sm font-semibold text-rv-forest dark:text-rv-vivid mt-3">
                  (11) 94174-1800
                </p>
                <a
                  href="https://wa.me/5511941741800?text=Olá!%20Preciso%20de%20suporte%20técnico%20no%20Renda%20Viva."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full mt-3 inline-block text-center bg-rv-green hover:bg-rv-forest dark:bg-rv-vivid dark:hover:bg-rv-green text-white font-poppins font-semibold rounded-xl py-2.5 text-sm transition-colors"
                >
                  Chamar no WhatsApp
                </a>
              </div>
            </div>

            {/* Aviso de atendimento */}
            <p className="text-xs text-rv-muted dark:text-rv-dark-muted mt-4 text-center">
              Atendimento de segunda a sexta, das 9h às 18h.
              Responderemos em até 24 horas úteis.
            </p>
          </div>

          {/* Zona de Perigo */}
          <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-red-900/30 p-6 space-y-4">
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
