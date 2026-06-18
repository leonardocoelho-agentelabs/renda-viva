-- Migration: 020_simulador.sql
-- Simulador Financeiro "E se?"

CREATE TABLE IF NOT EXISTS simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Input do usuário
  pergunta_original TEXT NOT NULL,

  -- Parâmetros extraídos pela IA
  tipo VARCHAR(50),        -- 'financiamento', 'investimento', 'cancelamento', 'compra', 'outro'
  valor DECIMAL(12,2),
  parcelas INTEGER,
  taxa_juros DECIMAL(5,2),

  -- Resultado
  impacto_1_ano JSONB,
  impacto_2_anos JSONB,
  impacto_5_anos JSONB,
  resumo TEXT,
  recomendacao TEXT,
  viabilidade VARCHAR(20),
  alternativas TEXT[],
  alertas TEXT[],

  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_simulations" ON simulations
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_simulations_user
  ON simulations(user_id, created_at DESC);
