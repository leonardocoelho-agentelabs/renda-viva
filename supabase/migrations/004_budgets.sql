-- ============================================
-- Migration: 004_budgets.sql
-- Orçamentos mensais por categoria
-- ============================================

-- 1. Criar tabela de orçamentos
CREATE TABLE IF NOT EXISTS public.budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    mes_ano TEXT NOT NULL,
    categoria TEXT NOT NULL,
    limite NUMERIC(10, 2) NOT NULL,
    gasto_atual NUMERIC(10, 2) DEFAULT 0,
    status TEXT DEFAULT 'sugerido' CHECK (status IN ('sugerido', 'aprovado', 'encerrado')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- Constraint unique: um orçamento por categoria por mês
    CONSTRAINT unique_user_mes_categoria UNIQUE (user_id, mes_ano, categoria)
);

-- 2. Criar índice para consultas por mês
CREATE INDEX IF NOT EXISTS idx_budgets_user_mes
    ON public.budgets (user_id, mes_ano);

-- 3. Criar função para updated_at automático
CREATE OR REPLACE FUNCTION update_budgets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Criar trigger para updated_at
DROP TRIGGER IF EXISTS update_budgets_updated_at ON public.budgets;
CREATE TRIGGER update_budgets_updated_at
    BEFORE UPDATE ON public.budgets
    FOR EACH ROW
    EXECUTE FUNCTION update_budgets_updated_at();

-- 5. Habilitar RLS
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

-- 6. Criar políticas RLS
DROP POLICY IF EXISTS "Users can view own budgets" ON public.budgets;
CREATE POLICY "Users can view own budgets"
    ON public.budgets FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own budgets" ON public.budgets;
CREATE POLICY "Users can insert own budgets"
    ON public.budgets FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own budgets" ON public.budgets;
CREATE POLICY "Users can update own budgets"
    ON public.budgets FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own budgets" ON public.budgets;
CREATE POLICY "Users can delete own budgets"
    ON public.budgets FOR DELETE
    USING (auth.uid() = user_id);

-- 7. Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.budgets TO authenticated;

-- ============================================
-- Verificação
-- ============================================
DO $$
BEGIN
    RAISE NOTICE 'Migration 004_budgets.sql executada com sucesso!';
    RAISE NOTICE 'Tabela: public.budgets';
    RAISE NOTICE 'Features:';
    RAISE NOTICE '  - Orçamentos mensais por categoria';
    RAISE NOTICE '  - Unique constraint: (user_id, mes_ano, categoria)';
    RAISE NOTICE '  - Status: sugerido, aprovado, encerrado';
    RAISE NOTICE '  - RLS habilitado';
END $$;