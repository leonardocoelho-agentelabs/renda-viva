-- Migration: 022_leaks
-- Tabela para armazenar histórico de análises de vazamentos financeiros

CREATE TABLE IF NOT EXISTS leaks_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  periodo INTEGER NOT NULL,
  resultado JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index para buscar análises por usuário ordenadas por data
CREATE INDEX IF NOT EXISTS idx_leaks_analysis_user_created ON leaks_analysis(user_id, created_at DESC);

-- Row Level Security
ALTER TABLE leaks_analysis ENABLE ROW LEVEL SECURITY;

-- Apenas o próprio usuário pode ver suas análises
CREATE POLICY "Users can view own leaks_analysis" ON leaks_analysis
  FOR SELECT USING (auth.uid() = user_id);

-- O sistema insere as análises
CREATE POLICY "System can insert leaks_analysis" ON leaks_analysis
  FOR INSERT WITH CHECK (true);

-- Comentário
COMMENT ON TABLE leaks_analysis IS 'Histórico de análises de vazamentos financeiros por usuário';
