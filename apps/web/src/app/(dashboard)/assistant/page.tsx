"use client";

import { useState, useRef, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { createClient } from "@/lib/supabase/client";
import { Send } from "lucide-react";

function VivaAvatar() {
  return (
    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-600 flex items-center justify-center">
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-[#F8FAFC]">Assistente</h1>
        <p className="text-gray-500 dark:text-[#94A3B8]">Tire dúvidas sobre suas finanças com IA</p>
      </div>

      <div className="flex flex-col bg-white dark:bg-[#111827] rounded-xl border border-gray-100 dark:border-[#1E293B] shadow-sm h-[calc(100dvh-240px)] md:h-[calc(100vh-220px)] overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50 dark:bg-[#0F172A]">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && <VivaAvatar />}
              <div
                className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm ${
                  msg.role === "user"
                    ? "bg-green-600 text-white rounded-br-sm whitespace-pre-wrap"
                    : "bg-white dark:bg-[#111827] border border-gray-100 dark:border-[#1E293B] shadow-sm text-gray-800 dark:text-gray-200 rounded-bl-sm"
                }`}
              >
                {msg.role === "user" ? msg.content : formatMessage(msg.content)}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3 justify-start">
              <VivaAvatar />
              <div className="max-w-[70%] px-4 py-2.5 rounded-2xl rounded-bl-sm text-sm bg-white dark:bg-[#111827] border border-gray-100 dark:border-[#1E293B] shadow-sm text-gray-500 dark:text-gray-400">
                Viva está pensando...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 dark:border-[#1E293B] p-4 flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem..."
            disabled={loading}
            className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-[#1E293B] rounded-lg text-sm text-gray-900 dark:text-[#F8FAFC] dark:bg-[#0F172A] placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:opacity-60"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
