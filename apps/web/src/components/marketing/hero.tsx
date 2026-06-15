"use client";

import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import { ScrollReveal } from "@/hooks/use-scroll-reveal";

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-rv-page via-rv-mint/30 to-rv-page" />
      <div className="absolute top-1/4 right-0 w-96 h-96 bg-rv-vivid/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 left-0 w-72 h-72 bg-rv-green/10 rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Content */}
          <div className="text-center lg:text-left">
            <ScrollReveal>
              <span className="inline-flex items-center gap-2 px-3 py-1 bg-rv-mint text-rv-forest text-sm font-medium rounded-full mb-6">
                <span className="w-2 h-2 bg-rv-vivid rounded-full animate-pulse" />
                Novo: Assistente IA disponível 24/7
              </span>
            </ScrollReveal>

            <ScrollReveal delay={100}>
              <h1 className="font-[family-name:var(--font-poppins)] text-4xl sm:text-5xl lg:text-6xl font-bold text-rv-ink leading-tight mb-6">
                Diga adeus ao{" "}
                <span className="text-rv-forest">atrito financeiro</span>
              </h1>
            </ScrollReveal>

            <ScrollReveal delay={200}>
              <p className="text-lg sm:text-xl text-rv-muted mb-8 max-w-xl mx-auto lg:mx-0">
                Transações automáticas, dashboards inteligentes e um assistente
                IA que conhece seu histórico financeiro. Zero fricção, máxima
                inteligência.
              </p>
            </ScrollReveal>

            <ScrollReveal delay={300}>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-rv-green text-white font-[family-name:var(--font-poppins)] font-semibold rounded-xl hover:bg-rv-forest transition-colors duration-150 cursor-pointer"
                >
                  Começar gratuitamente
                  <ArrowRight size={20} />
                </Link>
                <a
                  href="#como-funciona"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-transparent border-2 border-rv-light text-rv-green font-[family-name:var(--font-poppins)] font-semibold rounded-xl hover:border-rv-green transition-colors duration-150 cursor-pointer"
                >
                  <Play size={20} />
                  Ver como funciona
                </a>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={400}>
              <p className="mt-6 text-sm text-rv-muted">
                Sem cartão de crédito. Configure em 2 minutos.
              </p>
            </ScrollReveal>
          </div>

          {/* Dashboard Mockup */}
          <ScrollReveal delay={200}>
            <div className="relative">
              <div className="bg-rv-forest rounded-2xl p-6 shadow-2xl">
                {/* Dashboard Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-rv-soft text-sm">Saldo disponível</p>
                    <p className="font-[family-name:var(--font-poppins)] text-3xl font-bold text-white">
                      R$ 12.847,50
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-rv-soft text-sm">Score de saúde</p>
                    <p className="font-[family-name:var(--font-poppins)] text-2xl font-bold text-rv-vivid">
                      87/100
                    </p>
                  </div>
                </div>

                {/* Mini Cards */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="bg-rv-green/20 rounded-xl p-3">
                    <p className="text-rv-soft text-xs mb-1">Receitas</p>
                    <p className="font-[family-name:var(--font-poppins)] text-sm font-semibold text-white">
                      R$ 8.500
                    </p>
                  </div>
                  <div className="bg-rv-green/20 rounded-xl p-3">
                    <p className="text-rv-soft text-xs mb-1">Gastos</p>
                    <p className="font-[family-name:var(--font-poppins)] text-sm font-semibold text-white">
                      R$ 4.230
                    </p>
                  </div>
                  <div className="bg-rv-green/20 rounded-xl p-3">
                    <p className="text-rv-soft text-xs mb-1">Investido</p>
                    <p className="font-[family-name:var(--font-poppins)] text-sm font-semibold text-white">
                      R$ 18.420
                    </p>
                  </div>
                </div>

                {/* Transactions Preview */}
                <div className="space-y-2">
                  <p className="text-rv-soft text-xs font-medium">Últimas transações</p>
                  {[
                    { desc: "Supermercado Extra", cat: "Alimentação", val: "-R$ 234,50" },
                    { desc: "Salário", cat: "Receita", val: "+R$ 8.500,00" },
                    { desc: "Netflix", cat: "Lazer", val: "-R$ 55,90" },
                  ].map((t, i) => (
                    <div key={i} className="flex items-center justify-between bg-rv-ink/30 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-rv-vivid/30 rounded-lg flex items-center justify-center">
                          <span className="text-xs font-bold text-rv-vivid">
                            {t.desc[0]}
                          </span>
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">{t.desc}</p>
                          <p className="text-rv-muted text-xs">{t.cat}</p>
                        </div>
                      </div>
                      <span className={`font-[family-name:var(--font-poppins)] text-sm font-semibold ${t.val.startsWith("+") ? "text-rv-vivid" : "text-white"}`}>
                        {t.val}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Floating AI Badge */}
              <div className="absolute -right-4 top-1/4 bg-rv-card border border-rv-hairline rounded-xl px-4 py-3 shadow-lg">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-rv-green rounded-lg flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                      <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/>
                      <path d="M12 6v6l4 2"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-rv-ink text-sm font-medium">IA就活中</p>
                    <p className="text-rv-muted text-xs">Resposta instantânea</p>
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
