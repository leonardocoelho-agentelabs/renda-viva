"use client";

import { useState, useRef, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { createClient } from "@/lib/supabase/client";
import { Send } from "lucide-react";

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

const INITIAL_MESSAGE: Message = {
  role: "assistant",
  content:
    "Olá! Sou o Viva, seu assistente financeiro pessoal. Tenho acesso aos seus dados financeiros reais. Como posso ajudar?",
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
          <span className="dark:text-gray-300">{formatted.map((p, j) => <span key={j}>{p}</span>)}</span>
        </div>
      );
    }

    if (/^\d+\./.test(line)) {
      return (
        <div key={i} className="my-0.5 pl-1 dark:text-gray-300">
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

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
        body: JSON.stringify({ message: userMessage, history }),
      });

      if (!response.ok) {
        throw new Error(`Erro ${response.status}`);
      }

      const data = await response.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
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
      <div className="mb-8">
        <h1 className="font-[var(--font-poppins)] font-bold text-2xl text-rv-ink dark:text-rv-dark-ink">Assistente</h1>
        <p className="text-rv-muted dark:text-rv-dark-muted">Tire dúvidas sobre suas finanças com IA</p>
      </div>

      <div className="flex flex-col bg-white dark:bg-rv-dark-card rounded-xl border border-rv-forest/10 dark:border-rv-light/10 shadow-sm h-[calc(100dvh-240px)] md:h-[calc(100vh-220px)] overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-rv-mint/30 dark:bg-rv-dark-active-bg">
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
                    : "bg-white dark:bg-rv-dark-card border border-rv-forest/10 dark:border-rv-light/10 shadow-sm text-rv-ink dark:text-rv-dark-ink rounded-bl-sm"
                }`}
              >
                {msg.role === "user" ? msg.content : formatMessage(msg.content)}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3 justify-start">
              <VivaAvatar />
              <div className="max-w-[70%] px-4 py-2.5 rounded-2xl rounded-bl-sm text-sm bg-white dark:bg-rv-dark-card border border-rv-forest/10 dark:border-rv-light/10 shadow-sm text-rv-muted dark:text-rv-dark-muted">
                Viva está pensando...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-rv-forest/10 dark:border-rv-light/10 p-4 flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem..."
            disabled={loading}
            className="flex-1 px-4 py-2.5 border border-rv-forest/10 dark:border-rv-light/10 rounded-lg text-sm text-rv-ink dark:text-rv-dark-ink dark:bg-rv-dark-card placeholder:text-rv-muted/70 dark:placeholder:text-rv-dark-muted focus:outline-none focus:ring-2 focus:ring-rv-green focus:border-rv-green disabled:opacity-60"
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
    </DashboardLayout>
  );
}
