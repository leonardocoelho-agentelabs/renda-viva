-- Migration: 019_modo_crise_mentor_diagnostico.sql
-- Funcionalidades: Modo Crise, Modo Mentor Financeiro, Diagnóstico Automático

-- =====================================================
-- MODO CRISE: Coluna na tabela users
-- =====================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS modo_crise BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS modo_crise_ativado_em TIMESTAMPTZ;

-- =====================================================
-- MODO MENTOR: Tabela de objetivos do mentor
-- =====================================================
CREATE TABLE IF NOT EXISTS mentor_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  objetivo TEXT NOT NULL,
  valor_alvo DECIMAL(12,2),
  prazo DATE,
  ativo BOOLEAN DEFAULT true,
  progresso_atual DECIMAL(5,2) DEFAULT 0,
  ultimo_alerta TEXT,
  ultimo_alerta_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE mentor_objectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_mentor_objectives" ON mentor_objectives
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_mentor_objectives_user_id ON mentor_objectives(user_id);
CREATE INDEX IF NOT EXISTS idx_mentor_objectives_ativo ON mentor_objectives(ativo);

-- =====================================================
-- DIAGNÓSTICO: Tabela de diagnósticos financeiros
-- =====================================================
CREATE TABLE IF NOT EXISTS financial_diagnostics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  perfil_tipo VARCHAR(100),
  perfil_descricao TEXT,
  pontos_fortes JSONB DEFAULT '[]'::jsonb,
  pontos_fracos JSONB DEFAULT '[]'::jsonb,
  riscos JSONB DEFAULT '[]'::jsonb,
  oportunidades JSONB DEFAULT '[]'::jsonb,
  plano_melhoria JSONB DEFAULT '[]'::jsonb,
  frase_diagnostico TEXT,
  score_momento INTEGER,
  dados_analisados JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE financial_diagnostics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_financial_diagnostics" ON financial_diagnostics
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_financial_diagnostics_user_id ON financial_diagnostics(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_diagnostics_created_at ON financial_diagnostics(created_at DESC);
