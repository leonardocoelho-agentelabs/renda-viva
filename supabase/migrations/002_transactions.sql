-- ============================================
-- Migration: 002_transactions.sql
-- Tabela principal de transações financeiras
-- ============================================

-- 1. Criar tabela de transações
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    data DATE NOT NULL,
    valor NUMERIC(10, 2) NOT NULL,
    descricao_raw TEXT NOT NULL,
    categoria TEXT,
    subcategoria TEXT,
    score_confianca NUMERIC(3, 2) DEFAULT 0 CHECK (score_confianca >= 0 AND score_confianca <= 1),
    is_recorrente BOOLEAN DEFAULT false,
    periodicidade_dias INTEGER,
    tipo TEXT DEFAULT 'debito' CHECK (tipo IN ('debito', 'credito', 'pix', 'ted', 'doc', 'transferencia')),
    status_revisao TEXT DEFAULT 'pendente' CHECK (status_revisao IN ('aprovado', 'revisar', 'pendente')),
    estabelecimento TEXT,
    origem TEXT DEFAULT 'manual' CHECK (origem IN ('csv', 'pdf', 'open_finance', 'manual', 'webhook')),
    upload_id UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Criar índices para otimização de consultas
CREATE INDEX IF NOT EXISTS idx_transactions_user_data
    ON public.transactions (user_id, data DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_user_categoria
    ON public.transactions (user_id, categoria);

CREATE INDEX IF NOT EXISTS idx_transactions_user_status
    ON public.transactions (user_id, status_revisao);

CREATE INDEX IF NOT EXISTS idx_transactions_user_recorrente
    ON public.transactions (user_id, is_recorrente);

-- 3. Criar função para updated_at automático
CREATE OR REPLACE FUNCTION update_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Criar trigger para updated_at
DROP TRIGGER IF EXISTS update_transactions_updated_at ON public.transactions;
CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_transactions_updated_at();

-- 5. Habilitar RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- 6. Criar políticas RLS
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
CREATE POLICY "Users can view own transactions"
    ON public.transactions FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
CREATE POLICY "Users can insert own transactions"
    ON public.transactions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;
CREATE POLICY "Users can update own transactions"
    ON public.transactions FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own transactions" ON public.transactions;
CREATE POLICY "Users can delete own transactions"
    ON public.transactions FOR DELETE
    USING (auth.uid() = user_id);

-- 7. Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.transactions TO authenticated;

-- ============================================
-- Verificação
-- ============================================
DO $$
BEGIN
    RAISE NOTICE 'Migration 002_transactions.sql executada com sucesso!';
    RAISE NOTICE 'Tabela: public.transactions';
    RAISE NOTICE 'Features:';
    RAISE NOTICE '  - 4 índices para otimização';
    RAISE NOTICE '  - Trigger para updated_at automático';
    RAISE NOTICE '  - RLS habilitado (usuário só acessa próprias transações)';
END $$;