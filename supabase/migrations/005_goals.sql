-- ============================================
-- Migration: 005_goals.sql
-- Metas financeiras
-- ============================================

-- 1. Criar tabela de metas
CREATE TABLE IF NOT EXISTS public.goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    descricao TEXT,
    valor_alvo NUMERIC(10, 2) NOT NULL,
    valor_atual NUMERIC(10, 2) DEFAULT 0,
    data_alvo DATE,
    instrumento_recomendado TEXT,
    prioridade INTEGER DEFAULT 1,
    status TEXT DEFAULT 'ativa' CHECK (status IN ('ativa', 'pausada', 'concluida', 'cancelada')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Criar índice para consultas por status
CREATE INDEX IF NOT EXISTS idx_goals_user_status
    ON public.goals (user_id, status);

-- 3. Criar índice para ordenação por prioridade
CREATE INDEX IF NOT EXISTS idx_goals_user_prioridade
    ON public.goals (user_id, prioridade);

-- 4. Criar função para updated_at automático
CREATE OR REPLACE FUNCTION update_goals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Criar trigger para updated_at
DROP TRIGGER IF EXISTS update_goals_updated_at ON public.goals;
CREATE TRIGGER update_goals_updated_at
    BEFORE UPDATE ON public.goals
    FOR EACH ROW
    EXECUTE FUNCTION update_goals_updated_at();

-- 6. Habilitar RLS
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

-- 7. Criar políticas RLS
DROP POLICY IF EXISTS "Users can view own goals" ON public.goals;
CREATE POLICY "Users can view own goals"
    ON public.goals FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own goals" ON public.goals;
CREATE POLICY "Users can insert own goals"
    ON public.goals FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own goals" ON public.goals;
CREATE POLICY "Users can update own goals"
    ON public.goals FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own goals" ON public.goals;
CREATE POLICY "Users can delete own goals"
    ON public.goals FOR DELETE
    USING (auth.uid() = user_id);

-- 8. Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.goals TO authenticated;

-- ============================================
-- Verificação
-- ============================================
DO $$
BEGIN
    RAISE NOTICE 'Migration 005_goals.sql executada com sucesso!';
    RAISE NOTICE 'Tabela: public.goals';
    RAISE NOTICE 'Features:';
    RAISE NOTICE '  - Metas financeiras com valor atual/alvo';
    RAISE NOTICE '  - Status: ativa, pausada, concluida, cancelada';
    RAISE NOTICE '  - Prioridade para ordenação';
    RAISE NOTICE '  - Instrumento recomendado (CDB, Tesouro, etc)';
    RAISE NOTICE '  - RLS habilitado';
END $$;