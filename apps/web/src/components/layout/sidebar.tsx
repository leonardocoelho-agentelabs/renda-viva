"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, ArrowLeftRight, PieChart, Target, Heart, FileText, TrendingUp, Building2, MessageCircle, LogOut, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/transactions", label: "Transações", icon: ArrowLeftRight },
  { href: "/connections", label: "Contas", icon: Building2 },
  { href: "/budget", label: "Orçamentos", icon: PieChart },
  { href: "/goals", label: "Metas", icon: Target },
  { href: "/score", label: "Score", icon: Heart },
  { href: "/reports", label: "Relatórios", icon: FileText },
  { href: "/investments", label: "Investimentos", icon: TrendingUp },
  { href: "/assistant", label: "Assistente", icon: MessageCircle },
];

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const [nome, setNome] = useState("Usuário");
  const [email, setEmail] = useState("");

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!active || !user) return;
      const fullName =
        (user.user_metadata?.full_name as string | undefined) ||
        user.email?.split("@")[0] ||
        "Usuário";
      setNome(fullName);
      setEmail(user.email ?? "");
    });
    return () => {
      active = false;
    };
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const inicial = nome.charAt(0).toUpperCase();

  return (
    <aside className="w-60 h-screen bg-[#0F1117] flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">RV</span>
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-white font-semibold text-sm block leading-tight">Renda Viva</span>
            <p className="text-white/40 text-xs leading-tight">Gestão inteligente</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Fechar menu"
              className="text-white/50 hover:text-white flex-shrink-0"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium border-l-2",
                isActive
                  ? "bg-green-600/20 text-green-400 border-green-500"
                  : "text-white/60 hover:bg-white/5 hover:text-white border-transparent"
              )}
            >
              <item.icon className={cn("h-[18px] w-[18px]", isActive ? "text-green-400" : "text-white/50")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer com usuário */}
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-medium">{inicial}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">{nome}</p>
            <p className="text-white/40 text-xs truncate">{email}</p>
          </div>
          <button
            onClick={handleLogout}
            aria-label="Sair"
            className="text-white/40 hover:text-white/80 flex-shrink-0"
          >
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
    </aside>
  );
}
