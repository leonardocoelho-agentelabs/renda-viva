"use client";

import { ScrollReveal } from "@/hooks/use-scroll-reveal";

export function Transition() {
  return (
    <section className="py-20 lg:py-32 bg-rv-forest">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <ScrollReveal>
          <h2 className="font-[family-name:var(--font-poppins)] text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
            E se uma IA cuidasse disso por você?
          </h2>
        </ScrollReveal>

        <ScrollReveal delay={100}>
          <p className="text-lg sm:text-xl text-rv-soft max-w-2xl mx-auto mb-8">
            O Renda Viva aprende seu padrão financeiro, categoriza transações
            automaticamente e te dá insights antes que você precise pedir. Seu CFO
            pessoal, disponível 24 horas por dia.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={200}>
          <div className="flex flex-wrap justify-center gap-4">
            {[
              "Categorização automática",
              "Previsão de saldo",
              "Alertas inteligentes",
              "Recomendações personalizadas",
            ].map((tag) => (
              <span
                key={tag}
                className="px-4 py-2 bg-rv-green/30 text-rv-vivid text-sm font-medium rounded-full border border-rv-vivid/30"
              >
                {tag}
              </span>
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
