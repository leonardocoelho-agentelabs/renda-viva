-- ============================================
-- Migration: 008_bank_connections.sql
-- Conexões bancárias via Open Finance (Pluggy)
-- ============================================

CREATE TABLE IF NOT EXISTS public.bank_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  pluggy_item_id TEXT NOT NULL,
  institution_name TEXT NOT NULL,
  institution_logo TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'error', 'updating', 'disconnected')),
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_user_pluggy_item UNIQUE (user_id, pluggy_item_id)
);

CREATE INDEX IF NOT EXISTS idx_bank_connections_user_id
  ON public.bank_connections (user_id);

CREATE INDEX IF NOT EXISTS idx_bank_connections_item
  ON public.bank_connections (pluggy_item_id);

-- Trigger de updated_at (reutiliza a função genérica criada na 001)
DROP TRIGGER IF EXISTS update_bank_connections_updated_at ON public.bank_connections;
CREATE TRIGGER update_bank_connections_updated_at
  BEFORE UPDATE ON public.bank_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.bank_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only see own connections" ON public.bank_connections;
CREATE POLICY "Users can only see own connections"
  ON public.bank_connections FOR ALL
  USING (auth.uid() = user_id);

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.bank_connections TO authenticated;
