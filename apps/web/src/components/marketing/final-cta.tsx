"use client";

import Link from "next/link";
import { ScrollReveal } from "@/hooks/use-scroll-reveal";
import { ArrowRight } from "lucide-react";

export function FinalCTA() {
  return (
    <section className="py-20 lg:py-32 bg-rv-green">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <ScrollReveal>
          <h2 className="font-[family-name:var(--font-poppins)] text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
            Pronto para transformar sua vida financeira?
          </h2>
        </ScrollReveal>

        <ScrollReveal delay={100}>
          <p className="text-lg sm:text-xl text-rv-mint max-w-2xl mx-auto mb-8">
            Junte-se a milhares de pessoas que já descobriram como é simples ter
            controle total sobre suas finanças com inteligência artificial.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={200}>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-10 py-5 bg-white text-rv-green font-[family-name:var(--font-poppins)] font-semibold text-lg rounded-xl hover:bg-rv-mint transition-colors duration-150 cursor-pointer"
          >
            Criar minha conta gratuita
            <ArrowRight size={24} />
          </Link>
        </ScrollReveal>

        <ScrollReveal delay={300}>
          <p className="mt-6 text-rv-mint text-sm">
            Sem cartão de crédito. Configure em 2 minutos.
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}
