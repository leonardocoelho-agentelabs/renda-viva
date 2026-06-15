"use client";

import Link from "next/link";
import { RendaVivaMark } from "@/components/brand/renda-viva-mark";
import { Menu, X } from "lucide-react";
import { useState } from "react";

const navLinks = [
  { href: "#funcionalidades", label: "Funcionalidades" },
  { href: "#seguranca", label: "Segurança" },
  { href: "#planos", label: "Planos" },
  { href: "#faq", label: "FAQ" },
];

export function Nav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-rv-card/95 backdrop-blur-sm border-b border-rv-hairline">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 cursor-pointer">
            <RendaVivaMark size={40} variant="circle" />
            <span className="font-[family-name:var(--font-poppins)] font-semibold text-lg">
              <span className="text-rv-forest">Renda</span>
              <span className="text-rv-green">Viva</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-rv-muted hover:text-rv-forest font-medium transition-colors duration-150 cursor-pointer"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 text-rv-green font-medium hover:text-rv-forest transition-colors duration-150 cursor-pointer"
            >
              Entrar
            </Link>
            <Link
              href="/register"
              className="px-5 py-2.5 bg-rv-green text-white font-[family-name:var(--font-poppins)] font-semibold rounded-xl hover:bg-rv-forest transition-colors duration-150 cursor-pointer"
            >
              Criar conta
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-rv-muted hover:text-rv-forest cursor-pointer"
            aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileOpen && (
          <div className="md:hidden py-4 border-t border-rv-hairline">
            <div className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="text-rv-muted hover:text-rv-forest font-medium transition-colors duration-150 cursor-pointer"
                >
                  {link.label}
                </a>
              ))}
              <div className="flex flex-col gap-3 pt-4 border-t border-rv-hairline">
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="px-4 py-2 text-center text-rv-green font-medium hover:text-rv-forest transition-colors duration-150 cursor-pointer"
                >
                  Entrar
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMobileOpen(false)}
                  className="px-5 py-2.5 bg-rv-green text-white font-[family-name:var(--font-poppins)] font-semibold rounded-xl hover:bg-rv-forest transition-colors duration-150 text-center cursor-pointer"
                >
                  Criar conta
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
