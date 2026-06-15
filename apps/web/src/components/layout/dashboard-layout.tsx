"use client";

import { useState, type ReactNode, useEffect } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./mobile-nav";
import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    verificarAssinatura();
  }, []);

  const verificarAssinatura = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/subscriptions/me`, {
      headers: { 'Authorization': `Bearer ${session.access_token}` }
    });
    const json = await res.json();
    const temAcesso = json.temAcesso;

    if (!temAcesso && pathname !== '/assinar' && pathname !== '/settings') {
      router.push('/assinar');
    } else if (temAcesso && pathname === '/assinar') {
      router.push('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-rv-page dark:bg-rv-dark-bg">
      {/* Sidebar desktop — fixa */}
      <div className="hidden md:block fixed inset-y-0 left-0 z-30">
        <Sidebar />
      </div>

      {/* Sidebar mobile — overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative z-10">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Conteúdo principal */}
      <div className="md:pl-60">
        {/* Header mobile */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-rv-card dark:bg-rv-dark-card border-b border-rv-hairline dark:border-rv-dark-border sticky top-0 z-40">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menu"
            className="p-2 -ml-2 rounded-lg text-rv-muted dark:text-rv-dark-muted hover:bg-rv-mint dark:hover:bg-rv-dark-active-bg"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-rv-green rounded flex items-center justify-center">
              <span className="text-white font-bold text-[10px]">RV</span>
            </div>
            <span className="font-heading font-semibold text-rv-ink dark:text-rv-dark-ink text-sm">Renda Viva</span>
          </div>
          <div className="w-9" />
        </div>

        <main className="p-4 md:p-8 pb-24 md:pb-8 overflow-y-auto">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>
      </div>

      {/* Bottom nav mobile */}
      <MobileNav />
    </div>
  );
}
