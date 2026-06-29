-- ============================================
-- Migration: 025_families.sql
-- Modo Família — famílias, membros e vínculo no perfil
-- ============================================

-- 1. Tabela de famílias
CREATE TABLE IF NOT EXISTS public.families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL DEFAULT 'Nossa Família',
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabela de membros
CREATE TABLE IF NOT EXISTS public.family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email_convidado TEXT NOT NULL,
  nome_membro TEXT NOT NULL,
  whatsapp_membro TEXT,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'ativo', 'recusado', 'removido')),
  token_convite TEXT UNIQUE,
  token_expira_em TIMESTAMPTZ,
  convidado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  aceito_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Índices
CREATE INDEX IF NOT EXISTS idx_family_members_family_id ON public.family_members(family_id);
CREATE INDEX IF NOT EXISTS idx_family_members_user_id ON public.family_members(user_id);
CREATE INDEX IF NOT EXISTS idx_family_members_email ON public.family_members(email_convidado);
CREATE INDEX IF NOT EXISTS idx_family_members_token ON public.family_members(token_convite);
CREATE INDEX IF NOT EXISTS idx_families_owner ON public.families(owner_id);

-- 4. Trigger de updated_at (reaproveita função de 001_users.sql)
DROP TRIGGER IF EXISTS update_families_updated_at ON public.families;
CREATE TRIGGER update_families_updated_at
  BEFORE UPDATE ON public.families
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_family_members_updated_at ON public.family_members;
CREATE TRIGGER update_family_members_updated_at
  BEFORE UPDATE ON public.family_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 5. RLS families
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "titular_gerencia_familia" ON public.families;
CREATE POLICY "titular_gerencia_familia" ON public.families
  FOR ALL USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "membro_ve_familia" ON public.families;
CREATE POLICY "membro_ve_familia" ON public.families
  FOR SELECT USING (
    id IN (
      SELECT family_id FROM public.family_members
      WHERE user_id = auth.uid() AND status = 'ativo'
    )
  );

-- 6. RLS family_members
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "titular_gerencia_membros" ON public.family_members;
CREATE POLICY "titular_gerencia_membros" ON public.family_members
  FOR ALL USING (
    family_id IN (
      SELECT id FROM public.families WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "membro_ve_proprios_dados" ON public.family_members;
CREATE POLICY "membro_ve_proprios_dados" ON public.family_members
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "membro_atualiza_proprio" ON public.family_members;
CREATE POLICY "membro_atualiza_proprio" ON public.family_members
  FOR UPDATE USING (user_id = auth.uid());

-- 7. Vínculo no perfil do usuário
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES public.families(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_family_id ON public.users(family_id);

-- 8. Grants
GRANT ALL ON public.families TO authenticated;
GRANT ALL ON public.family_members TO authenticated;

-- ============================================
-- Verificação
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Migration 025_families.sql executada com sucesso!';
  RAISE NOTICE 'Tabelas: public.families, public.family_members';
  RAISE NOTICE 'Coluna adicionada: public.users.family_id';
END $$;
