"use client";

import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { createClient } from "@/lib/supabase/client";
import { Building2, Plus, RefreshCw, Trash2, Landmark } from "lucide-react";
import { cn } from "@/lib/utils";

interface Connection {
  id: string;
  pluggy_item_id: string;
  institution_name: string;
  institution_logo: string | null;
  status: "active" | "updating" | "error" | "disconnected";
  last_sync_at: string | null;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  active: "Ativo",
  updating: "Atualizando",
  error: "Erro",
  disconnected: "Desconectado",
};

const STATUS_BADGE: Record<string, string> = {
  active: "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400",
  updating: "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400",
  error: "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400",
  disconnected: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
};

function formatDateTime(value: string | null): string {
  if (!value) return "Nunca";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ConnectionsPage() {
  const supabase = createClient();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [totalImportadas, setTotalImportadas] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    if ((window as unknown as { PluggyConnect?: unknown }).PluggyConnect) {
      setScriptLoaded(true);
      return;
    }

    const id = "pluggy-connect-script";
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => setScriptLoaded(true));
      return;
    }

    const script = document.createElement("script");
    script.id = id;
    script.src = "https://cdn.pluggy.ai/pluggy-connect/latest/pluggy-connect.js";
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => console.error("Erro ao carregar script Pluggy Connect");
    document.body.appendChild(script);
  }, []);

  const getToken = useCallback(async (): Promise<string | null> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, [supabase]);

  const loadConnections = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        setError("Sessão expirada. Faça login novamente.");
        return;
      }
      const res = await fetch(`${apiUrl}/openfinance/connections`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const data = await res.json();
      setConnections(Array.isArray(data) ? data : []);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { count } = await supabase
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("origem", "open_finance");
        setTotalImportadas(count || 0);
      }
    } catch {
      setError("Não foi possível carregar suas contas.");
    } finally {
      setLoading(false);
    }
  }, [apiUrl, getToken, supabase]);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  const salvarConexao = useCallback(
    async (itemId: string) => {
      const token = await getToken();
      if (!token) return;
      try {
        await fetch(`${apiUrl}/openfinance/connections`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ itemId }),
        });
      } finally {
        await loadConnections();
      }
    },
    [apiUrl, getToken, loadConnections]
  );

  const abrirWidget = async () => {
    if (!scriptLoaded) {
      setError("O widget de conexão ainda está carregando. Tente novamente em instantes.");
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        setError("Sessão expirada. Faça login novamente.");
        return;
      }
      const res = await fetch(`${apiUrl}/openfinance/connect-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const { connectToken } = await res.json();

      const PluggyConnect = (window as unknown as { PluggyConnect?: new (opts: unknown) => { init: () => void } })
        .PluggyConnect;
      if (!PluggyConnect) {
        setError("O widget de conexão ainda está carregando. Tente novamente em instantes.");
        return;
      }

      const pluggyConnect = new PluggyConnect({
        connectToken,
        onSuccess: (itemData: { item?: { id?: string } }) => {
          const itemId = itemData?.item?.id;
          if (itemId) salvarConexao(itemId);
        },
        onError: () => {
          setError("Erro ao conectar o banco. Tente novamente.");
        },
        onClose: () => {},
      });
      pluggyConnect.init();
    } catch {
      setError("Não foi possível iniciar a conexão com o banco.");
    } finally {
      setConnecting(false);
    }
  };

  const sincronizar = async (itemId: string) => {
    setSyncingId(itemId);
    try {
      const token = await getToken();
      if (!token) return;
      await fetch(`${apiUrl}/openfinance/sync/${itemId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      await loadConnections();
    } finally {
      setSyncingId(null);
    }
  };

  const desconectar = async (id: string) => {
    const token = await getToken();
    if (!token) return;
    await fetch(`${apiUrl}/openfinance/connections/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setConnections((prev) => prev.filter((c) => c.id !== id));
  };

  const ultimaSync = connections
    .map((c) => c.last_sync_at)
    .filter(Boolean)
    .sort()
    .reverse()[0] as string | undefined;

  return (
    <DashboardLayout>
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-[var(--font-poppins)] font-bold text-2xl text-rv-ink dark:text-rv-dark-ink">Minhas Contas</h1>
          <p className="text-rv-muted dark:text-rv-dark-muted">Conecte seus bancos e importe transações automaticamente</p>
        </div>
        <button
          onClick={abrirWidget}
          disabled={connecting || !scriptLoaded}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-rv-green dark:bg-rv-vivid text-white text-sm font-medium hover:bg-rv-forest dark:hover:bg-rv-vivid/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="h-4 w-4" />
          {!scriptLoaded ? "Carregando..." : connecting ? "Abrindo..." : "Conectar banco"}
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Status geral */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-[#111827] rounded-xl border border-gray-100 dark:border-[#1E293B] shadow-sm p-5">
          <span className="text-xs font-medium text-gray-500 dark:text-[#94A3B8] uppercase tracking-wide">
            Bancos conectados
          </span>
          <p className="text-2xl font-bold text-gray-900 dark:text-[#F8FAFC] mt-2">{connections.length}</p>
        </div>
        <div className="bg-white dark:bg-[#111827] rounded-xl border border-gray-100 dark:border-[#1E293B] shadow-sm p-5">
          <span className="text-xs font-medium text-gray-500 dark:text-[#94A3B8] uppercase tracking-wide">
            Última sincronização
          </span>
          <p className="text-lg font-semibold text-gray-900 dark:text-[#F8FAFC] mt-2">{formatDateTime(ultimaSync ?? null)}</p>
        </div>
        <div className="bg-white dark:bg-[#111827] rounded-xl border border-gray-100 dark:border-[#1E293B] shadow-sm p-5">
          <span className="text-xs font-medium text-gray-500 dark:text-[#94A3B8] uppercase tracking-wide">
            Importadas automaticamente
          </span>
          <p className="text-2xl font-bold text-gray-900 dark:text-[#F8FAFC] mt-2">{totalImportadas}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-10 w-10 rounded-full border-2 border-green-500 border-t-transparent animate-spin mb-4" />
          <p className="text-gray-400">Carregando suas contas...</p>
        </div>
      ) : connections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-[#111827] rounded-xl border border-gray-100 dark:border-[#1E293B] shadow-sm">
          <Building2 className="h-14 w-14 text-gray-300 dark:text-gray-600 mb-3" />
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-1">Nenhum banco conectado</h2>
          <p className="text-gray-400 dark:text-gray-500 mb-6 max-w-sm">
            Conecte seu banco com segurança via Open Finance e suas transações chegam sozinhas.
          </p>
          <button
            onClick={abrirWidget}
            disabled={connecting || !scriptLoaded}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="h-4 w-4" />
            {!scriptLoaded ? "Carregando..." : "Conectar banco"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {connections.map((c) => (
            <div
              key={c.id}
              className="bg-white dark:bg-rv-dark-card rounded-xl border border-rv-forest/10 dark:border-rv-light/10 shadow-sm p-4 flex items-center gap-4"
            >
              <div className="w-11 h-11 rounded-lg bg-rv-mint/50 dark:bg-rv-dark-active-bg flex items-center justify-center overflow-hidden flex-shrink-0">
                {c.institution_logo ? (
                  <img src={c.institution_logo} alt={c.institution_name} className="w-full h-full object-contain" />
                ) : (
                  <Landmark className="h-5 w-5 text-rv-muted dark:text-rv-dark-muted" />
                )
                }
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-rv-ink dark:text-rv-dark-ink truncate">{c.institution_name}</h3>
                  <span
                    className={cn(
                      "text-xs font-medium px-2 py-0.5 rounded-full",
                      STATUS_BADGE[c.status] || STATUS_BADGE.disconnected
                    )}
                  >
                    {STATUS_LABEL[c.status] || c.status}
                  </span>
                </div>
                <p className="text-xs text-rv-muted dark:text-rv-dark-muted mt-0.5">
                  Última sincronização: {formatDateTime(c.last_sync_at)}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => sincronizar(c.pluggy_item_id)}
                  disabled={syncingId === c.pluggy_item_id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rv-forest/10 dark:border-rv-light/10 text-rv-muted dark:text-rv-dark-muted text-xs font-medium hover:bg-rv-mint/30 dark:hover:bg-rv-dark-card disabled:opacity-50 transition-colors"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", syncingId === c.pluggy_item_id && "animate-spin")} />
                  Sincronizar
                </button>
                <button
                  onClick={() => desconectar(c.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#1E293B] text-red-600 dark:text-red-400 text-xs font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Desconectar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
