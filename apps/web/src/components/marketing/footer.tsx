"use client";

import Link from "next/link";
import { RendaVivaMark } from "@/components/brand/renda-viva-mark";

const footerLinks = [
  { href: "/privacidade", label: "Política de Privacidade" },
  { href: "/termos", label: "Termos de Uso" },
  { href: "/suporte", label: "Suporte" },
];

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="py-12 bg-rv-forest">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* Logo and tagline */}
          <div className="flex flex-col items-center sm:items-start gap-3">
            <Link href="/" className="flex items-center gap-3 cursor-pointer">
              <RendaVivaMark size={36} variant="circle" />
              <div>
                <span className="font-[family-name:var(--font-poppins)] font-semibold text-lg text-white">
                  <span className="text-rv-vivid">Renda</span>
                  <span className="text-rv-soft">Viva</span>
                </span>
                <p className="text-rv-muted text-xs">Renda inteligente, viva.</p>
              </div>
            </Link>
          </div>

          {/* Links */}
          <nav className="flex flex-wrap justify-center gap-6">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-rv-soft hover:text-white text-sm transition-colors duration-150 cursor-pointer"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Divider */}
        <div className="my-8 border-t border-rv-green/30" />

        {/* Copyright */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-rv-muted">
          <p>
            © {currentYear} Renda Viva. Todos os direitos reservados.
          </p>
          <p className="flex items-center gap-2">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-rv-vivid"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Dados protegidos pela LGPD
          </p>
        </div>
      </div>
    </footer>
  );
}
