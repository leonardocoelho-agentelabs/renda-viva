"use client";

import { ScrollReveal } from "@/hooks/use-scroll-reveal";
import {
  Zap,
  LayoutDashboard,
  PiggyBank,
  MessageSquare,
  TrendingUp,
  FileText,
} from "lucide-react";

const features = [
  {
    tag: "Automação",
    icon: Zap,
    title: "Transações Automáticas",
    description:
      "Categorização por IA com aprendizado contínuo. Cada lançamento é classificado automaticamente com base no seu histórico, diminuindo o trabalho manual a quase zero.",
    visual: {
      type: "mini-cards",
      items: [
        { label: "Supermercado", cat: "Alimentação", val: "-R$ 156,80", color: "bg-amber-100" },
        { label: "Uber", cat: "Transporte", val: "-R$ 24,50", color: "bg-blue-100" },
        { label: "Salary", cat: "Receita", val: "+R$ 8.500,00", color: "bg-green-100" },
      ],
    },
  },
  {
    tag: "Visão",
    icon: LayoutDashboard,
    title: "Dashboard Inteligente",
    description:
      "Score de saúde financeira calculado em tempo real. Previsão de saldo para os próximos 30 dias baseada em seus padrões de gasto e receitas futuras.",
    visual: {
      type: "mini-cards",
      items: [
        { label: "Score", cat: "Saúde", val: "87/100", color: "bg-pink-100" },
        { label: "Previsão", cat: "30 dias", val: "R$ 9.240", color: "bg-purple-100" },
        { label: "Tendência", cat: "Gastos", val: "-12%", color: "bg-emerald-100" },
      ],
    },
  },
  {
    tag: "Planejamento",
    icon: PiggyBank,
    title: "Orçamento Adaptativo",
    description:
      "Baseado na regra 50/30/20, mas personalizado para você. O Renda Viva ajusta automaticamente os limites de cada categoria conforme seu comportamento real.",
    visual: {
      type: "mini-cards",
      items: [
        { label: "Necessidades", cat: "50%", val: "R$ 4.250", color: "bg-slate-100" },
        { label: "Desejos", cat: "30%", val: "R$ 2.550", color: "bg-rose-100" },
        { label: "Poupança", cat: "20%", val: "R$ 1.700", color: "bg-teal-100" },
      ],
    },
  },
  {
    tag: "IA",
    icon: MessageSquare,
    title: "Assistente Financeiro IA",
    description:
      'Chat com contexto financeiro real. Pergunte sobre padrões de gasto, investimentos sugeridos ou simplesmente "por que gastei tanto em fevereiro?". A IA conhece seu histórico completo.',
    visual: {
      type: "mini-cards",
      items: [
        { label: "Pergunta", cat: "Você", val: "Por que...", color: "bg-rv-mint" },
        { label: "Resposta", cat: "IA", val: "Porque...", color: "bg-rv-light" },
        { label: "Contexto", cat: "Histórico", val: "6 meses", color: "bg-rv-soft" },
      ],
    },
  },
  {
    tag: "Investimentos",
    icon: TrendingUp,
    title: "Radar de Investimentos",
    description:
      "Curadoria semanal personalizada baseada no seu perfil e objetivos. Receba recomendações de investimentos que fazem sentido para você, não dicas genéricas.",
    visual: {
      type: "mini-cards",
      items: [
        { label: "CDB", cat: "Renda fixa", val: "+1.2%", color: "bg-indigo-100" },
        { label: "ETF", cat: "Renda variável", val: "+0.8%", color: "bg-cyan-100" },
        { label: "Treasury", cat: "Internacional", val: "+0.5%", color: "bg-orange-100" },
      ],
    },
  },
  {
    tag: "Relatórios",
    icon: FileText,
    title: "Relatórios Automáticos",
    description:
      "Narrativa mensal gerada por IA. Em vez de planilhas cheias de números, receba um relatório claro: o que aconteceu, por que aconteceu e o que fazer diferente no próximo mês.",
    visual: {
      type: "mini-cards",
      items: [
        { label: "Resumo", cat: "Junho", val: "4 páginas", color: "bg-sky-100" },
        { label: "Insights", cat: "IA", val: "7 encontrados", color: "bg-violet-100" },
        { label: "Ações", cat: "Sugeridas", val: "3 próximas", color: "bg-fuchsia-100" },
      ],
    },
  },
];

export function Features() {
  return (
    <section id="funcionalidades" className="py-20 lg:py-32 bg-rv-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="text-center mb-16">
            <span className="inline-flex items-center px-3 py-1 bg-rv-mint text-rv-forest text-sm font-medium rounded-full mb-4">
              Funcionalidades
            </span>
            <h2 className="font-[family-name:var(--font-poppins)] text-3xl sm:text-4xl font-bold text-rv-ink mb-4">
              Tudo que você precisa para dominar suas finanças
            </h2>
            <p className="text-lg text-rv-muted max-w-2xl mx-auto">
              Seis módulos integrados que trabalham juntos para dar a você
              controle total sobre seu dinheiro.
            </p>
          </div>
        </ScrollReveal>

        <div className="space-y-20 lg:space-y-32">
          {features.map((feature, index) => (
            <ScrollReveal key={feature.title}>
              <div
                className={`grid lg:grid-cols-2 gap-12 lg:gap-16 items-center ${
                  index % 2 === 1 ? "lg:grid-flow-col-dense" : ""
                }`}
              >
                {/* Text Content */}
                <div className={index % 2 === 1 ? "lg:col-start-2" : ""}>
                  <span className="inline-flex items-center px-3 py-1 bg-rv-mint text-rv-forest text-sm font-medium rounded-full mb-4">
                    {feature.tag}
                  </span>
                  <h3 className="font-[family-name:var(--font-poppins)] text-2xl sm:text-3xl font-bold text-rv-ink mb-4">
                    {feature.title}
                  </h3>
                  <p className="text-rv-muted text-lg leading-relaxed">
                    {feature.description}
                  </p>
                </div>

                {/* Visual */}
                <div
                  className={`bg-rv-card border border-rv-hairline rounded-2xl p-6 ${
                    index % 2 === 1 ? "lg:col-start-1 lg:row-start-1" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <feature.icon size={20} className="text-rv-green" />
                    <span className="text-rv-muted text-sm font-medium">
                      Preview
                    </span>
                  </div>
                  <div className="space-y-3">
                    {feature.visual.items.map((item, i) => (
                      <div
                        key={i}
                        className={`${item.color} rounded-xl p-4 flex items-center justify-between`}
                      >
                        <div>
                          <p className="text-rv-ink font-medium text-sm">
                            {item.label}
                          </p>
                          <p className="text-rv-muted text-xs">{item.cat}</p>
                        </div>
                        <span className="font-[family-name:var(--font-poppins)] font-semibold text-rv-ink">
                          {item.val}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
