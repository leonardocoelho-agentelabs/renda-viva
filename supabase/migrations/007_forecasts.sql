-- ============================================
-- Migration: 007_forecasts.sql
-- Previsões de saldo (geradas pela IA)
-- ============================================

-- 1. Criar tabela de forecasts
CREATE TABLE IF NOT EXISTS public.forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    data_prevista DATE NOT NULL,
    saldo_projetado NUMERIC(10, 2) NOT NULL,
    confianca NUMERIC(3, 2) DEFAULT 0.5 CHECK (confianca >= 0 AND confianca <= 1),
    gerado_em TIMESTAMPTZ DEFAULT now(),

    -- Constraint unique: uma previsão por data por usuário
    CONSTRAINT unique_user_data_prevista UNIQUE (user_id, data_prevista)
);

-- 2. Criar índice para consultas por período
CREATE INDEX IF NOT EXISTS idx_forecasts_user_data
    ON public.forecasts (user_id, data_prevista);

-- 3. Criar índice para ordenar por confiança
CREATE INDEX IF NOT EXISTS idx_forecasts_confianca
    ON public.forecasts (user_id, confianca);

-- 4. Habilitar RLS
ALTER TABLE public.forecasts ENABLE ROW LEVEL SECURITY;

-- 5. Criar políticas RLS
DROP POLICY IF EXISTS "Users can view own forecasts" ON public.forecasts;
CREATE POLICY "Users can view own forecasts"
    ON public.forecasts FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own forecasts" ON public.forecasts;
CREATE POLICY "Users can insert own forecasts"
    ON public.forecasts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own forecasts" ON public.forecasts;
CREATE POLICY "Users can update own forecasts"
    ON public.forecasts FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own forecasts" ON public.forecasts;
CREATE POLICY "Users can delete own forecasts"
    ON public.forecasts FOR DELETE
    USING (auth.uid() = user_id);

-- 6. Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.forecasts TO authenticated;

-- ============================================
-- Verificação
-- ============================================
DO $$
BEGIN
    RAISE NOTICE 'Migration 007_forecasts.sql executada com sucesso!';
    RAISE NOTICE 'Tabela: public.forecasts';
    RAISE NOTICE 'Features:';
    RAISE NOTICE '  - Previsões de saldo geradas pela IA';
    RAISE NOTICE '  - Unique constraint: (user_id, data_prevista)';
    RAISE NOTICE '  - Score de confiança (0 a 1)';
    RAISE NOTICE '  - RLS habilitado';
END $$;