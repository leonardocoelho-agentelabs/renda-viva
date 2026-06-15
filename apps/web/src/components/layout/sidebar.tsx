"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, ArrowLeftRight, PieChart, Target, Heart, FileText, TrendingUp, Building2, MessageCircle, LogOut, X, Sun, Moon, Settings, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "@/components/theme/ThemeProvider";
import Logo from "@/components/brand/Logo";

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
    <aside className="w-60 h-screen bg-rv-dark-card flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-rv-dark-border">
        <div className="flex items-center gap-2.5">
          <Logo size={32} variant="dark" showText={false} />
          <div className="min-w-0 flex-1">
            <span className="text-rv-dark-ink font-heading font-semibold text-sm block leading-tight">Renda Viva</span>
            <p className="text-rv-dark-muted text-xs leading-tight">Gestão inteligente</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Fechar menu"
              className="text-rv-dark-muted hover:text-rv-dark-ink flex-shrink-0"
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
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium border-l-2 font-heading",
                isActive
                  ? "bg-rv-dark-active-bg text-rv-vivid border-rv-vivid"
                  : "text-rv-dark-muted hover:bg-white/5 hover:text-rv-dark-ink border-transparent"
              )}
            >
              <item.icon className={cn("h-[18px] w-[18px]", isActive ? "text-rv-vivid" : "text-rv-dark-muted")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer com usuário e toggle de tema */}
      <div className="px-4 py-4 border-t border-rv-dark-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-rv-green rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-medium">{inicial}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-rv-dark-ink text-xs font-medium truncate">{nome}</p>
            <p className="text-rv-dark-muted text-xs truncate">{email}</p>
          </div>
          <button
            onClick={toggleTheme}
            className="text-rv-dark-muted hover:text-rv-dark-ink flex-shrink-0 p-1.5 rounded-lg hover:bg-white/5 transition-colors"
            title={theme === 'light' ? 'Modo escuro' : 'Modo claro'}
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
          <button
            onClick={handleLogout}
            aria-label="Sair"
            className="text-rv-dark-muted hover:text-rv-dark-ink flex-shrink-0"
          >
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
    </aside>
  );
}
