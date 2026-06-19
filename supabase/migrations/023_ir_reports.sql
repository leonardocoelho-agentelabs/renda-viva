-- Migration: 023_ir_reports
-- Criado em: 2026-06-26
-- Descrição: Tabela para salvar relatórios de IR para consulta futura

CREATE TABLE ir_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ano INTEGER NOT NULL,
  dados JSONB NOT NULL,
  resumo_executivo TEXT,
  alerta_declaracao TEXT,
  total_rendimentos DECIMAL(12,2),
  total_deducoes DECIMAL(12,2),
  imposto_estimado DECIMAL(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice único para evitar duplicidade de relatórios por usuário/ano
CREATE UNIQUE INDEX idx_ir_reports_user_ano
  ON ir_reports(user_id, ano);

-- Habilitar RLS
ALTER TABLE ir_reports ENABLE ROW LEVEL SECURITY;

-- Policy: usuários só veem seus próprios relatórios
CREATE POLICY "users_own_ir_reports" ON ir_reports
  FOR ALL USING (auth.uid() = user_id);
