"use client";

import { ScrollReveal } from "@/hooks/use-scroll-reveal";
import { Clock, ScatterChart, Brain, Sliders } from "lucide-react";

const painPoints = [
  {
    icon: Clock,
    title: "Lançamento manual",
    description:
      "Anotar cada despesa no final do dia é tedioso e propenso a erros. Você esquece, arredonda valores, perde o contexto.",
  },
  {
    icon: ScatterChart,
    title: "Dados isolados",
    description:
      "Seu banco mostra uma coisa, seu cartão outra, seu controle de planilha outra. Não existe uma visão unificada.",
  },
  {
    icon: Brain,
    title: "Apps reativos",
    description:
      "A maioria dos apps só mostra o que já aconteceu. Você reage ao passado quando deveria estar planejando o futuro.",
  },
  {
    icon: Sliders,
    title: "Sem personalização",
    description:
      "Regras genéricas não funcionam. Cada pessoa tem hábitos, metas e contexto financeiro únicos.",
  },
];

export function PainPoints() {
  return (
    <section className="py-20 lg:py-32 bg-rv-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="text-center mb-16">
            <span className="inline-flex items-center px-3 py-1 bg-rv-mint text-rv-forest text-sm font-medium rounded-full mb-4">
              O problema
            </span>
            <h2 className="font-[family-name:var(--font-poppins)] text-3xl sm:text-4xl font-bold text-rv-ink mb-4">
              Gestão financeira não precisa ser assim
            </h2>
            <p className="text-lg text-rv-muted max-w-2xl mx-auto">
              Você já conhece esses problemas. A maioria das pessoas convive com
              eles todos os dias, aceitando como se fosse normal.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {painPoints.map((point, index) => (
            <ScrollReveal key={point.title} delay={index * 100}>
              <div className="bg-rv-page border border-rv-hairline rounded-2xl p-6 h-full">
                <div className="w-12 h-12 bg-rv-mint rounded-xl flex items-center justify-center mb-4">
                  <point.icon size={24} className="text-rv-forest" />
                </div>
                <h3 className="font-[family-name:var(--font-poppins)] text-lg font-semibold text-rv-ink mb-2">
                  {point.title}
                </h3>
                <p className="text-rv-muted text-sm leading-relaxed">
                  {point.description}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
