"use client";

import { ScrollReveal } from "@/hooks/use-scroll-reveal";
import { Shield, Lock, Eye, FileCheck } from "lucide-react";

const securityFeatures = [
  {
    icon: Shield,
    title: "Criptografia AES-256",
    description:
      "Seus dados são criptografados em repouso e em trânsito com o padrão militar AES-256. Ninguém acessa suas informações sem autorização.",
  },
  {
    icon: Lock,
    title: "TLS 1.3",
    description:
      "Todas as conexões usam TLS 1.3, a versão mais recente do protocolo de segurança. Sua comunicação com nossos servidores é.private.",
  },
  {
    icon: Eye,
    title: "Row Level Security (RLS)",
    description:
      "Regras de acesso no nível da linha no banco de dados. Cada usuário só vê seus próprios dados, mesmo que tente acessar via API.",
  },
  {
    icon: FileCheck,
    title: "Conformidade LGPD",
    description:
      "Totalmente alinhado à Lei Geral de Proteção de Dados. Seus dados são tratados com consentimento, usados apenas para o serviço e podem ser excluídos a qualquer momento.",
  },
];

export function Security() {
  return (
    <section id="seguranca" className="py-20 lg:py-32 bg-rv-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="text-center mb-16">
            <span className="inline-flex items-center px-3 py-1 bg-rv-mint text-rv-forest text-sm font-medium rounded-full mb-4">
              Segurança
            </span>
            <h2 className="font-[family-name:var(--font-poppins)] text-3xl sm:text-4xl font-bold text-rv-ink mb-4">
              Segurança de nível institucional
            </h2>
            <p className="text-lg text-rv-muted max-w-2xl mx-auto">
              Não inventamos segurança. Cada camada foi implementada com base em
              padrões reconhecidos internacionalmente e alinhamento à legislação
              brasileira.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {securityFeatures.map((feature, index) => (
            <ScrollReveal key={feature.title} delay={index * 100}>
              <div className="bg-rv-page border border-rv-hairline rounded-2xl p-6 h-full">
                <div className="w-12 h-12 bg-rv-mint rounded-xl flex items-center justify-center mb-4">
                  <feature.icon size={24} className="text-rv-forest" />
                </div>
                <h3 className="font-[family-name:var(--font-poppins)] text-lg font-semibold text-rv-ink mb-2">
                  {feature.title}
                </h3>
                <p className="text-rv-muted text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal>
          <div className="bg-rv-forest rounded-2xl p-8 lg:p-12">
            <div className="grid lg:grid-cols-2 gap-8 items-center">
              <div>
                <h3 className="font-[family-name:var(--font-poppins)] text-2xl font-bold text-white mb-4">
                  Open Finance Brasil
                </h3>
                <p className="text-rv-soft mb-4">
                  Estamos alinhados à Resolução CMN 4.949/2021 do Banco Central,
                  que estabelece os padrões do Open Finance no Brasil. Isso
                  significa que nos conectamos aos seus bancos de forma segura e
                  padronizada.
                </p>
                <p className="text-rv-soft">
                  Seus dados financeiros nunca são expostos. Utilizamos
                  tokenização de PII (Personally Identifiable Information) antes
                  de enviar qualquer dado ao Claude API para processamento de IA.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                {[
                  "AES-256",
                  "TLS 1.3",
                  "LGPD",
                  "Open Finance",
                  "RLS",
                  "Tokenização PII",
                ].map((badge) => (
                  <span
                    key={badge}
                    className="px-4 py-2 bg-rv-green/30 text-rv-vivid text-sm font-medium rounded-full border border-rv-vivid/30"
                  >
                    {badge}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
