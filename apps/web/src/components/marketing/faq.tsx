"use client";

import { useState } from "react";
import { ScrollReveal } from "@/hooks/use-scroll-reveal";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    question: "Como funciona a conexão com meu banco?",
    answer:
      "Utilizamos o Open Finance Brasil (Resolução CMN 4.949/2021) para conectar-se aos bancos de forma segura e padronizada. Você autoriza a conexão diretamente no aplicativo do seu banco, com consentimento explícito. Seus dados são transmitidos via TLS 1.3 e criptografados com AES-256.",
  },
  {
    question: "A categorização por IA é confiável?",
    answer:
      "Sim. Nossa IA aprende com cada transação que você confirma ou corrige. Inicialmente, a acurácia é alta para categorias comuns (alimentação, transporte, moradia), e aumenta conforme você usa o app. Você sempre pode corrigir uma categorização, e a IA incorpora esse feedback.",
  },
  {
    question: "Posso cancelar a qualquer momento?",
    answer:
      "Sim, sem burocracia. Você pode cancelar sua assinatura a qualquer momento pelo painel de configurações. Seus dados são mantidos por 30 dias após o cancelamento (para caso você mude de ideia), e podem ser exportados ou excluídos permanentemente a seu pedido.",
  },
  {
    question: "O assistente IA tem acesso ao meu histórico completo?",
    answer:
      "Sim, e essa é uma das principais vantagens. O assistente conhece todas as suas transações, receitas, gastos por categoria, evolução patrimonial e metas. Isso permite respostas contextualizadas e recomendações personalizadas, não genéricas.",
  },
  {
    question: "Quais bancos são suportados?",
    answer:
      "Qualquer banco que participe do Open Finance Brasil. Isso inclui os principais bancos (Bradesco, Itaú, Santander, BB, Caixa, Nubank, Inter, C6, etc.). A lista completa está disponível em nosso site. Bancos que ainda não participam do Open Finance podem ser adicionados via importação de extrato.",
  },
  {
    question: "Meus dados estão seguros?",
    answer:
      "Seus dados são criptografados com AES-256, transmitidos via TLS 1.3, e acessíveis apenas a você (Row Level Security no banco de dados). Seguimos a LGPD e tokenizamos qualquer PII antes de enviar dados ao Claude API. Não vendemos nem compartilhamos seus dados com terceiros.",
  },
];

function FAQItem({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-rv-hairline rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-4 px-6 py-4 bg-rv-card hover:bg-rv-page text-left cursor-pointer transition-colors duration-150"
      >
        <span className="font-medium text-rv-ink">{question}</span>
        <ChevronDown
          size={20}
          className={`text-rv-muted flex-shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      {isOpen && (
        <div className="px-6 py-4 bg-rv-page border-t border-rv-hairline">
          <p className="text-rv-muted leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  );
}

export function FAQ() {
  return (
    <section id="faq" className="py-20 lg:py-32 bg-rv-card">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="text-center mb-12">
            <span className="inline-flex items-center px-3 py-1 bg-rv-mint text-rv-forest text-sm font-medium rounded-full mb-4">
              FAQ
            </span>
            <h2 className="font-[family-name:var(--font-poppins)] text-3xl sm:text-4xl font-bold text-rv-ink mb-4">
              Perguntas frequentes
            </h2>
            <p className="text-lg text-rv-muted">
              Respondemos as dúvidas mais comuns sobre o Renda Viva.
            </p>
          </div>
        </ScrollReveal>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <ScrollReveal key={index} delay={index * 50}>
              <FAQItem question={faq.question} answer={faq.answer} />
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
