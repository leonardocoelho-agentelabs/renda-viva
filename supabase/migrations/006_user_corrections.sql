-- ============================================
-- Migration: 006_user_corrections.sql
-- Correções manuais de categorização
-- Usadas como few-shot para o Claude
-- ============================================

-- 1. Criar tabela de correções
CREATE TABLE IF NOT EXISTS public.user_corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    descricao_raw TEXT NOT NULL,
    categoria_correta TEXT NOT NULL,
    subcategoria_correta TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Criar índice para listagem por data (mais recentes primeiro)
CREATE INDEX IF NOT EXISTS idx_user_corrections_user_created
    ON public.user_corrections (user_id, created_at DESC);

-- 3. Criar índice para busca por categoria
CREATE INDEX IF NOT EXISTS idx_user_corrections_categoria
    ON public.user_corrections (user_id, categoria_correta);

-- 4. Habilitar RLS
ALTER TABLE public.user_corrections ENABLE ROW LEVEL SECURITY;

-- 5. Criar políticas RLS
DROP POLICY IF EXISTS "Users can view own corrections" ON public.user_corrections;
CREATE POLICY "Users can view own corrections"
    ON public.user_corrections FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own corrections" ON public.user_corrections;
CREATE POLICY "Users can insert own corrections"
    ON public.user_corrections FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own corrections" ON public.user_corrections;
CREATE POLICY "Users can update own corrections"
    ON public.user_corrections FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own corrections" ON public.user_corrections;
CREATE POLICY "Users can delete own corrections"
    ON public.user_corrections FOR DELETE
    USING (auth.uid() = user_id);

-- 6. Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.user_corrections TO authenticated;

-- ============================================
-- Verificação
-- ============================================
DO $$
BEGIN
    RAISE NOTICE 'Migration 006_user_corrections.sql executada com sucesso!';
    RAISE NOTICE 'Tabela: public.user_corrections';
    RAISE NOTICE 'Features:';
    RAISE NOTICE '  - Histórico de correções de categorização';
    RAISE NOTICE '  - Usado como few-shot para o Claude';
    RAISE NOTICE '  - RLS habilitado';
END $$;