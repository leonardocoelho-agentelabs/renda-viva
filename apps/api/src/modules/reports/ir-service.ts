import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "../../plugins/supabase.js";
import { env } from "../../env.js";

const anthropic = new Anthropic({ apiKey: env.CLAUDE_API_KEY });

// Palavras-chave para classificação de transações
const PALAVRAS_SAUDE = [
  "hospital", "clinica", "farmacia", "medico", "dentista", "laboratorio",
  "plano de saude", "convenio", "exame", "consulta", "remedios", "saude",
  "vacina", "psicologo", "fisioterapia", "terapia", "medicamento",
  "ambulatorio", "urgencia", "emergencia", "pronto socorro", "raio x",
  "ultrassom", "tomografia", "ressonancia", "biopsia", "procedimento",
];

const PALAVRAS_EDUCACAO = [
  "escola", "faculdade", "universidade", "curso", "ensino", "mensalidade",
  "colegio", "creche", "educacao", "pos", "mestrado", "doutorado",
  "informatica", "idiomas", "ingles", "espanhol", "vestibular", "enem",
  "material", "livro", " apostila", "trabalho escolar",
];

const PALAVRAS_RENDIMENTOS = [
  "salario", "salário", "freela", "freelance", "freelancer", "aluguel",
  "honorario", "honorário", "pro-labore", "pró-labore", "comissão",
  "comissao", "bonus", "bônus", "premio", "prêmio", "venda",
];

const PALAVRAS_RENDIMENTOS_ISENTOS = [
  "restituicao", "restituição", "devolucao", "devolução", "pix",
  "transferencia", "presente", "doacao", "doação", "heranca", "herança",
];

export interface TransacaoIR {
  id: string;
  data: string;
  valor: number;
  descricao_raw: string;
  categoria: string;
  tipo: string;
}

export interface TransacaoClassificada {
  transacao: TransacaoIR;
  tipo_classificacao: string;
  sub_tipo: string;
}

export interface RelatorioIR {
  ano: number;
  usuario: {
    nome: string;
    cpf_mascarado: string;
  };
  gerado_em: string;

  rendimentos: {
    tributaveis: { total: number; transacoes: TransacaoIR[] };
    isentos: { total: number; transacoes: TransacaoIR[] };
    total_geral: number;
  };

  despesas_dedutiveis: {
    saude: { total: number; transacoes: TransacaoIR[] };
    educacao: { total: number; transacoes: TransacaoIR[] };
    previdencia: { total: number; transacoes: TransacaoIR[] };
    total_geral: number;
  };

  investimentos: {
    aportes: { total: number; transacoes: TransacaoIR[] };
    resgates: { total: number; transacoes: TransacaoIR[] };
    saldo_liquido: number;
  };

  por_mes: Record<string, { receitas: number; despesas: number; saldo: number }>;

  analise_ia: {
    resumo_executivo: string;
    alerta_declaracao: string;
    deducoes_possiveis: {
      saude: { total: number; sem_limite: boolean; observacao: string };
      educacao: { total: number; limite_legal: number; deducao_real: number; observacao: string };
      previdencia_oficial: { total: number; observacao: string };
    };
    total_deducoes: number;
    base_calculo_estimada: number;
    imposto_estimado: number;
    dicas_declaracao: string[];
    documentos_necessarios: string[];
    alertas: string[];
  };

  resumo: {
    total_receitas: number;
    total_despesas: number;
    total_deducoes: number;
    base_calculo: number;
    imposto_estimado: number;
  };
}

// Função para classificar uma transação
function classificarTransacao(transacao: TransacaoIR): { tipo: string; sub_tipo: string } {
  const descLower = (transacao.descricao_raw || "").toLowerCase();
  const catLower = (transacao.categoria || "").toLowerCase();
  const textoCompleto = `${descLower} ${catLower}`;
  const valor = Number(transacao.valor);

  // Rendimentos positivos
  if (valor > 0) {
    // Verificar palavras de rendimentos isentos primeiro
    if (PALAVRAS_RENDIMENTOS_ISENTOS.some(p => textoCompleto.includes(p))) {
      return { tipo: "rendimento_isento", sub_tipo: "outros" };
    }

    // Verificar palavras de rendimentos tributáveis
    if (PALAVRAS_RENDIMENTOS.some(p => textoCompleto.includes(p))) {
      return { tipo: "rendimento_tributavel", sub_tipo: "renda_variável" };
    }

    // Categoria Receita
    if (catLower === "receita") {
      return { tipo: "rendimento_tributavel", sub_tipo: "receita" };
    }

    // PIX/transfers de pessoa física geralmente são isentos
    if (textoCompleto.includes("pix") && !textoCompleto.includes("recebimento")) {
      return { tipo: "rendimento_isento", sub_tipo: "pix_pf" };
    }

    // Default para positivo sem classificação clara = rendimento isento
    return { tipo: "rendimento_isento", sub_tipo: "outros" };
  }

  // Despesas negativas
  // Saúde
  if (PALAVRAS_SAUDE.some(p => textoCompleto.includes(p)) || catLower === "saúde") {
    return { tipo: "despesa_saude", sub_tipo: "dedutivel" };
  }

  // Educação
  if (PALAVRAS_EDUCACAO.some(p => textoCompleto.includes(p)) || catLower === "educação") {
    return { tipo: "despesa_educacao", sub_tipo: "dedutivel" };
  }

  // Previdência
  if (textoCompleto.includes("inss") || textoCompleto.includes("previdencia") ||
      textoCompleto.includes("previdência") || textoCompleto.includes("pgbl") ||
      textoCompleto.includes("vblp")) {
    return { tipo: "despesa_previdencia", sub_tipo: "dedutivel" };
  }

  // Investimentos (aportes negativos = saída de dinheiro para investimento)
  if (catLower === "investimentos" || textoCompleto.includes("investimento") ||
      textoCompleto.includes("cdb") || textoCompleto.includes("tesouro") ||
      textoCompleto.includes("renda fixa") || textoCompleto.includes("fundo")) {
    return { tipo: "investimento", sub_tipo: valor < 0 ? "aporte" : "resgate" };
  }

  // Demais transações = outros gastos
  return { tipo: "outros_gastos", sub_tipo: catLower || "sem_categoria" };
}

// Máscara CPF
function mascararCPF(cpf: string | null): string {
  if (!cpf) return "***.***.***-**";
  const nums = cpf.replace(/\D/g, "");
  if (nums.length !== 11) return "***.***.***-**";
  return `${nums.slice(0, 3)}.***.***-${nums.slice(9, 11)}`;
}

// Gerar análise via Claude Sonnet
async function gerarAnaliseIA(
  ano: number,
  totalRendimentos: number,
  totalSaude: number,
  totalEducacao: number,
  totalPrevidencia: number,
  totalInvestimentos: number,
  totalTransacoes: number
): Promise<RelatorioIR["analise_ia"]> {
  // Limite de declaração 2025
  const limiteDeclaracao = 33888;

  // Calcular deduções com limites
  const deducaoEducacao = Math.min(totalEducacao, 3561.50);
  const totalDeducoes = totalSaude + deducaoEducacao + totalPrevidencia;

  // Base de cálculo (rendimentos - deduções)
  const baseCalculo = Math.max(0, totalRendimentos - totalDeducoes);

  // Estimar imposto (tabela IRPF 2025 simplificada)
  let impostoEstimado = 0;
  if (baseCalculo > 0) {
    if (baseCalculo <= 24511.92) {
      impostoEstimado = 0;
    } else if (baseCalculo <= 33919.80) {
      impostoEstimado = baseCalculo * 0.075 - 1838.39;
    } else if (baseCalculo <= 45012.60) {
      impostoEstimado = baseCalculo * 0.15 - 4516.02;
    } else if (baseCalculo <= 55976.16) {
      impostoEstimado = baseCalculo * 0.225 - 8481.95;
    } else {
      impostoEstimado = baseCalculo * 0.275 - 12104.48;
    }
  }

  const prompt = `
Você é um especialista em Imposto de Renda Pessoa Física (IRPF) brasileiro.
Analise os dados financeiros do ano ${ano} e gere um relatório completo para facilitar a declaração de IR.

DADOS DO ANO ${ano}:
Rendimentos tributáveis: R$ ${totalRendimentos.toFixed(2)}
Despesas de saúde: R$ ${totalSaude.toFixed(2)}
Despesas de educação: R$ ${totalEducacao.toFixed(2)}
Despesas de previdência: R$ ${totalPrevidencia.toFixed(2)}
Investimentos: R$ ${totalInvestimentos.toFixed(2)}
Total de transações: ${totalTransacoes}

Retorne SOMENTE um JSON válido com esta estrutura exata:
{
  "resumo_executivo": "resumo em 2-3 frases sobre o ano fiscal",
  "alerta_declaracao": "frase sobre se precisa ou não declarar (limite ${limiteDeclaracao})",
  "deducoes_possiveis": {
    "saude": {
      "total": ${totalSaude.toFixed(2)},
      "sem_limite": true,
      "observacao": "saúde não tem limite de dedução"
    },
    "educacao": {
      "total": ${totalEducacao.toFixed(2)},
      "limite_legal": 3561.50,
      "deducao_real": ${deducaoEducacao.toFixed(2)},
      "observacao": "limitado a R$3.561,50 por dependente"
    },
    "previdencia_oficial": {
      "total": ${totalPrevidencia.toFixed(2)},
      "observacao": "INSS e previdência complementar deduzem integralmente"
    }
  },
  "total_deducoes": ${totalDeducoes.toFixed(2)},
  "base_calculo_estimada": ${baseCalculo.toFixed(2)},
  "imposto_estimado": ${Math.max(0, impostoEstimado).toFixed(2)},
  "dicas_declaracao": [
    "dica específica e acionável em pt-BR"
  ],
  "documentos_necessarios": [
    "documento necessário em pt-BR"
  ],
  "alertas": [
    "alerta importante se houver, em pt-BR"
  ]
}
`.trim();

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0];
    if (text && text.type === "text") {
      const jsonMatch = text.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }
  } catch (error) {
    console.error("Erro ao gerar análise IA:", error);
  }

  // Fallback se a IA falhar
  const precisaDeclarar = totalRendimentos > limiteDeclaracao;
  return {
    resumo_executivo: `Em ${ano}, você recebeu R$ ${totalRendimentos.toFixed(2)} em rendimentos tributáveis. Suas despesas dedutíveis totalizaram R$ ${totalDeducoes.toFixed(2)}.`,
    alerta_declaracao: precisaDeclarar
      ? `Você provavelmente PRECISA declarar. Rendimentos de R$ ${totalRendimentos.toFixed(2)} ultrapassam o limite de R$ ${limiteDeclaracao}.`
      : `Você provavelmente NÃO precisa declarar. Rendimentos de R$ ${totalRendimentos.toFixed(2)} estão abaixo do limite de R$ ${limiteDeclaracao}.`,
    deducoes_possiveis: {
      saude: { total: totalSaude, sem_limite: true, observacao: "Saúde não tem limite de dedução" },
      educacao: { total: totalEducacao, limite_legal: 3561.50, deducao_real: deducaoEducacao, observacao: "Limitado a R$3.561,50 por dependente" },
      previdencia_oficial: { total: totalPrevidencia, observacao: "INSS e previdência complementar deduzem integralmente" },
    },
    total_deducoes: totalDeducoes,
    base_calculo_estimada: baseCalculo,
    imposto_estimado: Math.max(0, impostoEstimado),
    dicas_declaracao: [
      "Guarde todos os recibos médicos e odontológicos do ano",
      "Solicite o informe de rendimentos do seu empregador",
      "Reúna comprovantes de mensalidades escolares",
      "Declare dependentes para aumentar suas deduções",
    ],
    documentos_necessarios: [
      "Informe de rendimentos do empregador",
      "Informe de rendimentos bancários",
      "Recibos médicos e odontológicos",
      "Comprovantes de despesas educacionais",
      "Extrato de contribuições ao INSS",
    ],
    alertas: [],
  };
}

// Função principal para gerar o relatório de IR
export async function gerarRelatorioIR(userId: string, ano?: number): Promise<RelatorioIR> {
  const anoRef = ano || new Date().getFullYear() - 1;
  const anoNum = Number(anoRef);

  // 1. Buscar dados do usuário
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("full_name, cpf, renda_mensal")
    .eq("id", userId)
    .single();

  // 2. Buscar TODAS as transações do ano
  const { data: transacoes } = await supabaseAdmin
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .gte("data", `${anoNum}-01-01`)
    .lte("data", `${anoNum}-12-31`)
    .order("data", { ascending: true });

  // 3. Classificar transações
  const transacoesClassificadas: TransacaoClassificada[] = (transacoes || []).map((t) => {
    const { tipo, sub_tipo } = classificarTransacao(t as TransacaoIR);
    return {
      transacao: t as TransacaoIR,
      tipo_classificacao: tipo,
      sub_tipo,
    };
  });

  // 4. Separar por tipo
  const rendimentosTributaveis = transacoesClassificadas
    .filter((t) => t.tipo_classificacao === "rendimento_tributavel")
    .map((t) => t.transacao);

  const rendimentosIsentos = transacoesClassificadas
    .filter((t) => t.tipo_classificacao === "rendimento_isento")
    .map((t) => t.transacao);

  const despesasSaude = transacoesClassificadas
    .filter((t) => t.tipo_classificacao === "despesa_saude")
    .map((t) => t.transacao);

  const despesasEducacao = transacoesClassificadas
    .filter((t) => t.tipo_classificacao === "despesa_educacao")
    .map((t) => t.transacao);

  const despesasPrevidencia = transacoesClassificadas
    .filter((t) => t.tipo_classificacao === "despesa_previdencia")
    .map((t) => t.transacao);

  const investimentosAportes = transacoesClassificadas
    .filter((t) => t.tipo_classificacao === "investimento" && t.sub_tipo === "aporte")
    .map((t) => t.transacao);

  const investimentosResgates = transacoesClassificadas
    .filter((t) => t.tipo_classificacao === "investimento" && t.sub_tipo === "resgate")
    .map((t) => t.transacao);

  // 5. Calcular totais
  const totalRendTrib = rendimentosTributaveis.reduce((s, t) => s + Number(t.valor), 0);
  const totalRendIsentos = rendimentosIsentos.reduce((s, t) => s + Number(t.valor), 0);
  const totalSaude = despesasSaude.reduce((s, t) => s + Math.abs(Number(t.valor)), 0);
  const totalEducacao = despesasEducacao.reduce((s, t) => s + Math.abs(Number(t.valor)), 0);
  const totalPrevidencia = despesasPrevidencia.reduce((s, t) => s + Math.abs(Number(t.valor)), 0);
  const totalAportes = investimentosAportes.reduce((s, t) => s + Math.abs(Number(t.valor)), 0);
  const totalResgates = investimentosResgates.reduce((s, t) => s + Math.abs(Number(t.valor)), 0);

  // 6. Calcular totais por mês
  const porMes: Record<string, { receitas: number; despesas: number; saldo: number }> = {};
  for (let mes = 1; mes <= 12; mes++) {
    const chave = `${anoNum}-${String(mes).padStart(2, "0")}`;
    porMes[chave] = { receitas: 0, despesas: 0, saldo: 0 };
  }

  (transacoes || []).forEach((t) => {
    const mes = t.data.slice(0, 7);
    if (porMes[mes]) {
      if (Number(t.valor) > 0) {
        porMes[mes].receitas += Number(t.valor);
      } else {
        porMes[mes].despesas += Math.abs(Number(t.valor));
      }
      porMes[mes].saldo += Number(t.valor);
    }
  });

  // 7. Gerar análise IA
  const analiseIA = await gerarAnaliseIA(
    anoNum,
    totalRendTrib,
    totalSaude,
    totalEducacao,
    totalPrevidencia,
    totalAportes,
    (transacoes || []).length
  );

  // 8. Montar relatório completo
  return {
    ano: anoNum,
    usuario: {
      nome: user?.full_name || "Usuário",
      cpf_mascarado: mascararCPF(user?.cpf || null),
    },
    gerado_em: new Date().toISOString(),

    rendimentos: {
      tributaveis: { total: totalRendTrib, transacoes: rendimentosTributaveis },
      isentos: { total: totalRendIsentos, transacoes: rendimentosIsentos },
      total_geral: totalRendTrib + totalRendIsentos,
    },

    despesas_dedutiveis: {
      saude: { total: totalSaude, transacoes: despesasSaude },
      educacao: { total: totalEducacao, transacoes: despesasEducacao },
      previdencia: { total: totalPrevidencia, transacoes: despesasPrevidencia },
      total_geral: totalSaude + totalEducacao + totalPrevidencia,
    },

    investimentos: {
      aportes: { total: totalAportes, transacoes: investimentosAportes },
      resgates: { total: totalResgates, transacoes: investimentosResgates },
      saldo_liquido: totalAportes - totalResgates,
    },

    por_mes: porMes,

    analise_ia: analiseIA,

    resumo: {
      total_receitas: totalRendTrib + totalRendIsentos,
      total_despesas: (transacoes || [])
        .filter((t) => Number(t.valor) < 0)
        .reduce((s, t) => s + Math.abs(Number(t.valor)), 0),
      total_deducoes: analiseIA.total_deducoes,
      base_calculo: analiseIA.base_calculo_estimada,
      imposto_estimado: analiseIA.imposto_estimado,
    },
  };
}
