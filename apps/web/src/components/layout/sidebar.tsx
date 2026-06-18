"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  ArrowLeftRight,
  PieChart,
  Target,
  Heart,
  FileText,
  TrendingUp,
  Building2,
  MessageCircle,
  LogOut,
  X,
  Sun,
  Moon,
  Settings,
  CreditCard,
  Stethoscope,
  Zap,
  CalendarDays,
  Droplets,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "@/components/theme/ThemeProvider";
import Logo from "@/components/brand/Logo";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transações", icon: ArrowLeftRight },
  { href: "/connections", label: "Contas", icon: Building2 },
  { href: "/budget", label: "Orçamentos", icon: PieChart },
  { href: "/goals", label: "Metas", icon: Target },
  { href: "/diagnostico", label: "Diagnóstico", icon: Stethoscope },
  { href: "/score", label: "Score", icon: Heart },
  { href: "/reports", label: "Relatórios", icon: FileText },
  { href: "/investments", label: "Investimentos", icon: TrendingUp },
  { href: "/assistant", label: "Assistente", icon: MessageCircle },
  { href: "/simulador", label: "Simulador", icon: Zap },
  { href: "/calendario", label: "Calendário", icon: CalendarDays },
  { href: "/vazamentos", label: "Vazamentos", icon: Droplets },
  { href: "/assinar", label: "Assinatura", icon: CreditCard },
  { href: "/settings", label: "Configurações", icon: Settings },
];

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { theme, toggleTheme } = useTheme();

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
    <aside className="w-60 h-screen flex flex-col flex-shrink-0 bg-rv-forest dark:bg-[#141414]">
      {/* Logo e cabeçalho */}
      <div className="px-6 py-5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <Logo size={32} variant="light" showText={false} />
          <div className="min-w-0 flex-1">
            <span className="font-[var(--font-poppins)] font-semibold text-sm text-white dark:text-white block leading-tight">
              Renda Viva
            </span>
            <p className="text-rv-soft/70 dark:text-[#8A8A8A] text-[10px] leading-tight">Gestão Inteligente</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Fechar menu"
              className="text-white/60 hover:text-white flex-shrink-0"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-medium transition-all duration-150",
                isActive
                  ? "bg-rv-vivid text-white font-semibold dark:bg-rv-vivid dark:text-white"
                  : "text-white/70 dark:text-[#8A8A8A] hover:bg-white/10 dark:hover:bg-white/5 hover:text-white dark:hover:text-white"
              )}
            >
              <item.icon
                className={cn(
                  "w-4 h-4 flex-shrink-0",
                  isActive ? "text-white dark:text-white" : "text-white/60 dark:text-[#8A8A8A]"
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer com usuário e ações */}
      <div className="px-4 py-4 border-t border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-rv-mint dark:bg-rv-vivid/20 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-rv-green dark:text-rv-vivid text-xs font-semibold">{inicial}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white dark:text-white text-xs font-medium truncate">{nome}</p>
            <p className="text-white/50 dark:text-[#8A8A8A] text-[10px] truncate">{email}</p>
          </div>
          <button
            onClick={toggleTheme}
            className="text-white/50 dark:text-[#8A8A8A] hover:text-white dark:hover:text-white flex-shrink-0 p-1.5 rounded-lg hover:bg-white/10 dark:hover:bg-white/5 transition-colors"
            title={theme === 'light' ? 'Modo escuro' : 'Modo claro'}
          >
            {theme === 'light' ? (
              <Moon className="w-4 h-4" />
            ) : (
              <Sun className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={handleLogout}
            aria-label="Sair"
            className="text-white/50 dark:text-[#8A8A8A] hover:text-white dark:hover:text-white flex-shrink-0"
          >
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
    </aside>
  );
}
