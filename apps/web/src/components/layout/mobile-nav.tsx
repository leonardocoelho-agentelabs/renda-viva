"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ArrowLeftRight, PieChart, Target, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", icon: Home, label: "Início" },
  { href: "/transactions", icon: ArrowLeftRight, label: "Extratos" },
  { href: "/budget", icon: PieChart, label: "Orçamento" },
  { href: "/goals", icon: Target, label: "Metas" },
  { href: "/assistant", icon: MessageCircle, label: "Viva" },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 safe-area-pb">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg",
                active ? "text-green-600" : "text-gray-400 hover:text-gray-600"
              )}
            >
              <Icon className={cn("w-5 h-5", active ? "stroke-[2.5]" : "stroke-2")} />
              <span
                className={cn(
                  "text-[10px] font-medium",
                  active ? "text-green-600" : "text-gray-400"
                )}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
