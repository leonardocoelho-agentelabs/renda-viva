"use client";

import Link from "next/link";
import { ScrollReveal } from "@/hooks/use-scroll-reveal";
import { Check } from "lucide-react";

const planFeatures = [
  "Transações ilimitadas",
  "Categorização automática por IA",
  "Dashboard com score de saúde",
  "Previsão de saldo (30 dias)",
  "Orçamento adaptativo 50/30/20",
  "Assistente IA (chat com contexto)",
  "Radar de investimentos",
  "Relatórios mensais gerados por IA",
  "Conexão com bancos (Open Finance)",
  "Suporte prioritário",
];

export function Pricing() {
  return (
    <section id="planos" className="py-20 lg:py-32 bg-rv-page">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="text-center mb-16">
            <span className="inline-flex items-center px-3 py-1 bg-rv-mint text-rv-forest text-sm font-medium rounded-full mb-4">
              Preços
            </span>
            <h2 className="font-[family-name:var(--font-poppins)] text-3xl sm:text-4xl font-bold text-rv-ink mb-4">
              Simples e transparente
            </h2>
            <p className="text-lg text-rv-muted max-w-2xl mx-auto">
              Um plano, todas as funcionalidades. Sem surpresas, sem features
              trancadas.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal>
          <div className="bg-rv-forest rounded-3xl p-8 lg:p-12">
            {/* Plan Header */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-8">
              <div>
                <span className="inline-flex items-center gap-2 px-3 py-1 bg-rv-vivid/20 text-rv-vivid text-sm font-medium rounded-full mb-3">
                  <span className="w-2 h-2 bg-rv-vivid rounded-full" />
                  Plano único
                </span>
                <h3 className="font-[family-name:var(--font-poppins)] text-2xl font-bold text-white mb-1">
                  Renda Viva Pro
                </h3>
                <p className="text-rv-soft">Tudo incluído, sem limitações</p>
              </div>
              <div className="text-left sm:text-right">
                <div className="flex items-baseline gap-1">
                  <span className="font-[family-name:var(--font-poppins)] text-5xl font-bold text-white">
                    R$ 29
                  </span>
                  <span className="text-rv-soft">/mês</span>
                </div>
                {/* TODO: confirmar precificação com Léo antes do lançamento */}
                <p className="text-rv-soft text-sm mt-1">
                  Cobrança anual (R$ 348/ano) ou mensal
                </p>
              </div>
            </div>

            {/* Features List */}
            <div className="grid sm:grid-cols-2 gap-4 mb-8">
              {planFeatures.map((feature) => (
                <div key={feature} className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-rv-mint rounded-full flex items-center justify-center flex-shrink-0">
                    <Check size={14} className="text-rv-forest" />
                  </div>
                  <span className="text-rv-soft text-sm">{feature}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <Link
              href="/register"
              className="block w-full sm:w-auto sm:inline-flex items-center justify-center gap-2 px-8 py-4 bg-rv-card text-rv-forest font-[family-name:var(--font-poppins)] font-semibold rounded-xl hover:bg-rv-mint transition-colors duration-150 cursor-pointer"
            >
              Começar agora
            </Link>

            <p className="mt-4 text-rv-soft text-sm text-center sm:text-left">
              7 dias de teste gratuito. Cancele quando quiser.
            </p>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
