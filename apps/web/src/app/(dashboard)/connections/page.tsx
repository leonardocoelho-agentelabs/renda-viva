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
  active: "bg-green-50 text-green-700",
  updating: "bg-yellow-50 text-yellow-700",
  error: "bg-red-50 text-red-700",
  disconnected: "bg-gray-100 text-gray-600",
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

  // Carregar o script do widget Pluggy
  useEffect(() => {
    const id = "pluggy-connect-script";
    if (document.getElementById(id)) return;
    const script = document.createElement("script");
    script.id = id;
    script.src = "https://cdn.pluggy.ai/pluggy-connect/v2/pluggy-connect.js";
    script.async = true;
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

      // Total de transações importadas automaticamente (origem open_finance)
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
          <h1 className="text-2xl font-bold text-gray-900">Minhas Contas</h1>
          <p className="text-gray-500">Conecte seus bancos e importe transações automaticamente</p>
        </div>
        <button
          onClick={abrirWidget}
          disabled={connecting}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="h-4 w-4" />
          {connecting ? "Abrindo..." : "Conectar banco"}
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Status geral */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Bancos conectados
          </span>
          <p className="text-2xl font-bold text-gray-900 mt-2">{connections.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Última sincronização
          </span>
          <p className="text-lg font-semibold text-gray-900 mt-2">{formatDateTime(ultimaSync ?? null)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Importadas automaticamente
          </span>
          <p className="text-2xl font-bold text-gray-900 mt-2">{totalImportadas}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-10 w-10 rounded-full border-2 border-green-500 border-t-transparent animate-spin mb-4" />
          <p className="text-gray-400">Carregando suas contas...</p>
        </div>
      ) : connections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-xl border border-gray-100 shadow-sm">
          <Building2 className="h-14 w-14 text-gray-300 mb-3" />
          <h2 className="text-lg font-semibold text-gray-700 mb-1">Nenhum banco conectado</h2>
          <p className="text-gray-400 mb-6 max-w-sm">
            Conecte seu banco com segurança via Open Finance e suas transações chegam sozinhas.
          </p>
          <button
            onClick={abrirWidget}
            disabled={connecting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Conectar banco
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {connections.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4"
            >
              <div className="w-11 h-11 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                {c.institution_logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.institution_logo} alt={c.institution_name} className="w-full h-full object-contain" />
                ) : (
                  <Landmark className="h-5 w-5 text-gray-400" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-gray-900 truncate">{c.institution_name}</h3>
                  <span
                    className={cn(
                      "text-xs font-medium px-2 py-0.5 rounded-full",
                      STATUS_BADGE[c.status] || STATUS_BADGE.disconnected
                    )}
                  >
                    {STATUS_LABEL[c.status] || c.status}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  Última sincronização: {formatDateTime(c.last_sync_at)}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => sincronizar(c.pluggy_item_id)}
                  disabled={syncingId === c.pluggy_item_id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", syncingId === c.pluggy_item_id && "animate-spin")} />
                  Sincronizar
                </button>
                <button
                  onClick={() => desconectar(c.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-red-600 text-xs font-medium hover:bg-red-50 transition-colors"
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
