-- Categorias personalizadas por usuário
CREATE TABLE IF NOT EXISTS user_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, nome)
);

-- RLS: cada usuário só vê e gerencia as próprias categorias
ALTER TABLE user_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_categories_select" ON user_categories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_categories_insert" ON user_categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_categories_delete" ON user_categories
  FOR DELETE USING (auth.uid() = user_id);

-- Índice de performance
CREATE INDEX IF NOT EXISTS idx_user_categories_user_id
  ON user_categories(user_id);
