"use client";

import { useState, useRef, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { createClient } from "@/lib/supabase/client";
import { Send, Trash2, Plus, MessageSquare, Brain, ChevronRight, X } from "lucide-react";

function VivaAvatar() {
  return (
    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-rv-green dark:bg-rv-vivid flex items-center justify-center">
      <span className="text-white text-sm font-semibold">V</span>
    </div>
  );
}

interface Message {
  role: "assistant" | "user";
  content: string;
}

interface Session {
  session_id: string;
  primeira_mensagem: string;
  total_mensagens: number;
  created_at: string;
}

const INITIAL_MESSAGE: Message = {
  role: "assistant",
  content:
    "Olá! Sou o Viva, seu assistente financeiro pessoal. Tenho acesso aos seus dados financeiros reais e lembro de nossas conversas anteriores. Como posso ajudar?",
};

function formatMessage(text: string): React.ReactNode {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    const parts = line.split(/\*\*(.*?)\*\*/g);
    const formatted = parts.map((part, j) =>
      j % 2 === 1 ? (
        <strong key={j} className="font-semibold">
          {part}
        </strong>
      ) : (
        part
      )
    );

    if (line.startsWith("- ") || line.startsWith("* ")) {
      return (
        <div key={i} className="flex gap-2 my-0.5">
          <span className="text-green-600 dark:text-green-400 font-bold mt-0.5">•</span>
          <span className="dark:text-[#F0F0F0]">{formatted.map((p, j) => <span key={j}>{p}</span>)}</span>
        </div>
      );
    }

    if (/^\d+\./.test(line)) {
      return (
        <div key={i} className="my-0.5 pl-1 dark:text-[#F0F0F0]">
          {formatted.map((p, j) => (
            <span key={j}>{p}</span>
          ))}
        </div>
      );
    }

    if (line.trim() === "") return <div key={i} className="h-2" />;

    return (
      <div key={i} className="my-0.5 dark:text-gray-300">
        {formatted.map((p, j) => (
          <span key={j}>{p}</span>
        ))}
      </div>
    );
  });
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [hasMemory, setHasMemory] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [showSessions, setShowSessions] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // Gerar ou recuperar session_id do localStorage
  useEffect(() => {
    let storedSessionId = localStorage.getItem("viva_session_id");
    if (!storedSessionId) {
      storedSessionId = crypto.randomUUID();
      localStorage.setItem("viva_session_id", storedSessionId);
    }
    setSessionId(storedSessionId);

    // Buscar histórico da sessão
    loadSessionHistory(storedSessionId);

    // Buscar memórias
    checkMemory();

    // Buscar sessões
    loadSessions();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadSessionHistory = async (sid: string) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) return;

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
      const response = await fetch(`${apiUrl}/assistant/history?session_id=${sid}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.messages && data.messages.length > 0) {
          const historyMessages: Message[] = data.messages.map(
            (m: { role: string; content: string }) => ({
              role: m.role as "assistant" | "user",
              content: m.content,
            })
          );
          setMessages(historyMessages);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar histórico:", error);
    }
  };

  const checkMemory = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) return;

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
      const response = await fetch(`${apiUrl}/assistant/memory`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setHasMemory(data.hasMemory);
      }
    } catch (error) {
      console.error("Erro ao verificar memórias:", error);
    }
  };

  const loadSessions = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) return;

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
      const response = await fetch(`${apiUrl}/assistant/sessions`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
      }
    } catch (error) {
      console.error("Erro ao carregar sessões:", error);
    }
  };

  const startNewSession = () => {
    const newSessionId = crypto.randomUUID();
    localStorage.setItem("viva_session_id", newSessionId);
    setSessionId(newSessionId);
    setMessages([INITIAL_MESSAGE]);
    loadSessions();
  };

  const loadSession = (sid: string) => {
    localStorage.setItem("viva_session_id", sid);
    setSessionId(sid);
    loadSessionHistory(sid);
    setShowSessions(false);
  };

  const clearHistory = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) return;

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
      const response = await fetch(`${apiUrl}/assistant/history`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.ok) {
        setMessages([INITIAL_MESSAGE]);
        startNewSession();
      }
    } catch (error) {
      console.error("Erro ao limpar histórico:", error);
    } finally {
      setShowClearConfirm(false);
    }
  };

  const sendMessage = async () => {
    const userMessage = input.trim();
    if (!userMessage || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Sessão expirada. Por favor, faça login novamente." },
        ]);
        return;
      }

      const history = messages.slice(-10);

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
      const response = await fetch(`${apiUrl}/assistant/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ message: userMessage, history, sessionId }),
      });

      if (!response.ok) {
        throw new Error(`Erro ${response.status}`);
      }

      const data = await response.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.response }]);

      // Atualizar indicator de memória após resposta
      setTimeout(() => {
        checkMemory();
        loadSessions();
      }, 1000);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Desculpe, ocorreu um erro. Tente novamente." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-[var(--font-poppins)] font-bold text-2xl text-rv-ink dark:text-[#F0F0F0]">
              Assistente
            </h1>
            <p className="text-rv-muted dark:text-[#8A8A8A]">
              Tire dúvidas sobre suas finanças com IA
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasMemory && (
              <span className="px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium rounded-full flex items-center gap-1">
                <Brain className="w-3.5 h-3.5" />
                Viva lembra de você
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-4 h-[calc(100dvh-240px)] md:h-[calc(100vh-220px)]">
        {/* Sidebar de sessões */}
        {showSessions && (
          <div className="w-72 bg-white dark:bg-[#1E1E1E] rounded-xl border border-white/8 shadow-sm p-4 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-rv-ink dark:text-[#F0F0F0]">
                Conversas Anteriores
              </h2>
              <button
                onClick={() => setShowSessions(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded"
              >
                <X className="w-4 h-4 text-rv-muted" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {sessions.map((sessao) => (
                <button
                  key={sessao.session_id}
                  onClick={() => loadSession(sessao.session_id)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    sessao.session_id === sessionId
                      ? "bg-rv-green/10 dark:bg-rv-vivid/10 border border-rv-green/20"
                      : "hover:bg-gray-50 dark:hover:bg-white/5"
                  }`}
                >
                  <p className="text-sm text-rv-ink dark:text-[#F0F0F0] line-clamp-2">
                    {sessao.primeira_mensagem}...
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-rv-muted">
                    <span>{formatDate(sessao.created_at)}</span>
                    <span>•</span>
                    <span>{sessao.total_mensagens} msgs</span>
                  </div>
                </button>
              ))}
              {sessions.length === 0 && (
                <p className="text-sm text-rv-muted text-center py-4">
                  Nenhuma conversa anterior
                </p>
              )}
            </div>
          </div>
        )}

        {/* Chat principal */}
        <div className="flex-1 flex flex-col bg-white dark:bg-[#1E1E1E] rounded-xl border border-white/8 shadow-sm overflow-hidden">
          {/* Header do chat */}
          <div className="border-b border-white/5 p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-rv-muted" />
              <span className="text-sm text-rv-muted">
                Sessão atual
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSessions(!showSessions)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                title="Ver conversas anteriores"
              >
                <MessageSquare className="w-4 h-4 text-rv-muted" />
              </button>
              <button
                onClick={startNewSession}
                className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                title="Nova conversa"
              >
                <Plus className="w-4 h-4 text-rv-muted" />
              </button>
              <button
                onClick={() => setShowClearConfirm(true)}
                className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                title="Limpar histórico"
              >
                <Trash2 className="w-4 h-4 text-red-500" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-rv-mint/30 dark:bg-white/5">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && <VivaAvatar />}
                <div
                  className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm ${
                    msg.role === "user"
                      ? "bg-rv-green dark:bg-rv-vivid text-white rounded-br-sm whitespace-pre-wrap"
                      : "bg-white dark:bg-[#1E1E1E] border border-white/10 shadow-sm text-rv-ink dark:text-[#F0F0F0] rounded-bl-sm"
                  }`}
                >
                  {msg.role === "user" ? msg.content : formatMessage(msg.content)}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-3 justify-start">
                <VivaAvatar />
                <div className="max-w-[70%] px-4 py-2.5 rounded-2xl rounded-bl-sm text-sm bg-white dark:bg-[#1E1E1E] border border-white/10 shadow-sm text-[#8A8A8A]">
                  Viva está pensando...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-white/5 p-4 flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua mensagem..."
              disabled={loading}
              className="flex-1 px-4 py-2.5 border border-white/10 dark:border-white/10 rounded-lg text-sm text-rv-ink dark:text-[#F0F0F0] dark:bg-[#2A2A2A] placeholder:text-rv-muted/70 dark:placeholder:text-[#8A8A8A] focus:outline-none focus:ring-2 focus:ring-rv-green focus:border-rv-green disabled:opacity-60"
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="px-4 py-2.5 bg-rv-green dark:bg-rv-vivid text-white rounded-lg hover:bg-rv-forest dark:hover:bg-rv-vivid/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal de confirmação para limpar histórico */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#1E1E1E] rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="font-semibold text-rv-ink dark:text-[#F0F0F0] mb-2">
              Limpar todo o histórico?
            </h3>
            <p className="text-sm text-rv-muted mb-4">
              Esta ação não pode ser desfeita. Todo o histórico de conversas com a Viva
              será apagado permanentemente.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-sm text-rv-muted hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={clearHistory}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Limpar tudo
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}