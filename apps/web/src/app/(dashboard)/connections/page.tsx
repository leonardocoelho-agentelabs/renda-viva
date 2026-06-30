"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Building2, Sparkles, CheckCircle2, Clock } from "lucide-react";

export default function ConnectionsPage() {
  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto py-12 px-4">

        {/* Badge "Em desenvolvimento" */}
        <div className="flex justify-center mb-8">
          <span className="inline-flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-sm font-medium px-4 py-2 rounded-full border border-amber-200 dark:border-amber-800/40">
            <Clock className="w-4 h-4" />
            Em desenvolvimento
          </span>
        </div>

        {/* Ícone central */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-2xl bg-rv-mint dark:bg-rv-vivid/15 flex items-center justify-center">
            <Building2 className="w-10 h-10 text-rv-green dark:text-rv-vivid" />
          </div>
        </div>

        {/* Título e descrição */}
        <div className="text-center mb-10">
          <h1 className="font-[var(--font-poppins)] font-bold text-2xl text-rv-ink dark:text-[#F0F0F0] mb-3">
            Conexão automática com seus bancos está chegando
          </h1>
          <p className="text-rv-muted dark:text-[#8A8A8A] text-base leading-relaxed max-w-lg mx-auto">
            Estamos finalizando a integração com o Open Finance — o padrão
            oficial do Banco Central — para que suas transações sejam
            importadas automaticamente, sem precisar fazer upload de extrato.
          </p>
        </div>

        {/* Como vai funcionar */}
        <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-gray-100 dark:border-white/8 p-6 mb-6">
          <h2 className="font-semibold text-rv-ink dark:text-[#F0F0F0] mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-rv-green dark:text-rv-vivid" />
            Como vai funcionar
          </h2>
          <ul className="space-y-3">
            {[
              "Conecte sua conta bancária com poucos cliques, com segurança bancária total",
              "Suas transações aparecem automaticamente no Renda Viva — sem upload manual de CSV",
              "Categorização por IA acontece em tempo real, assim que o dinheiro entra ou sai",
              "Suporte para os principais bancos do Brasil: Itaú, Bradesco, Santander, Nubank, Inter, Caixa, Banco do Brasil e mais",
              "Você nunca compartilha sua senha com o Renda Viva — a conexão é feita via Open Finance, regulado pelo Banco Central",
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-rv-ink dark:text-[#F0F0F0]">
                <CheckCircle2 className="w-4 h-4 text-rv-green dark:text-rv-vivid mt-0.5 flex-shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Aviso de acesso gratuito */}
        <div className="bg-rv-mint dark:bg-rv-green/10 rounded-2xl border border-rv-green/15 dark:border-rv-vivid/20 p-6 text-center">
          <p className="font-semibold text-rv-forest dark:text-rv-vivid mb-1">
            🎁 Você já está garantido
          </p>
          <p className="text-sm text-rv-ink dark:text-[#F0F0F0] leading-relaxed">
            Como assinante atual do Renda Viva, você terá acesso à conexão
            automática com seus bancos <strong>sem nenhum custo adicional</strong>,
            assim que a funcionalidade for lançada. Você não precisa fazer nada —
            o acesso é automático para todos os clientes ativos.
          </p>
        </div>

        {/* Enquanto isso */}
        <p className="text-center text-sm text-rv-muted dark:text-[#8A8A8A] mt-8">
          Enquanto isso, continue importando seus extratos em{" "}
          <a href="/transactions" className="text-rv-green dark:text-rv-vivid font-medium hover:underline">
            Transações
          </a>{" "}
          — é rápido e leva menos de 1 minuto.
        </p>

      </div>
    </DashboardLayout>
  );
}
