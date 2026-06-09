-- ============================================
-- Migration: 003_uploads.sql
-- Controle de uploads de extratos (CSV, PDF, OFX)
-- ============================================

-- 1. Criar tabela de uploads
CREATE TABLE IF NOT EXISTS public.uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('csv', 'pdf', 'ofx')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'error')),
    total_transacoes INTEGER DEFAULT 0,
    transacoes_processadas INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Criar função para updated_at automático
CREATE OR REPLACE FUNCTION update_uploads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Criar trigger para updated_at
DROP TRIGGER IF EXISTS update_uploads_updated_at ON public.uploads;
CREATE TRIGGER update_uploads_updated_at
    BEFORE UPDATE ON public.uploads
    FOR EACH ROW
    EXECUTE FUNCTION update_uploads_updated_at();

-- 4. Habilitar RLS
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;

-- 5. Criar políticas RLS
DROP POLICY IF EXISTS "Users can view own uploads" ON public.uploads;
CREATE POLICY "Users can view own uploads"
    ON public.uploads FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own uploads" ON public.uploads;
CREATE POLICY "Users can insert own uploads"
    ON public.uploads FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own uploads" ON public.uploads;
CREATE POLICY "Users can update own uploads"
    ON public.uploads FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own uploads" ON public.uploads;
CREATE POLICY "Users can delete own uploads"
    ON public.uploads FOR DELETE
    USING (auth.uid() = user_id);

-- 6. Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.uploads TO authenticated;

-- 7. Adicionar foreign key em transactions (referência circular)
-- Esta FK é adicionada aqui pois uploads deve existir antes de transactions referenciá-la
-- A coluna upload_id já existe em transactions, só precisamos da constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_upload'
        AND table_name = 'transactions'
    ) THEN
        ALTER TABLE public.transactions
        ADD CONSTRAINT fk_upload
        FOREIGN KEY (upload_id) REFERENCES public.uploads(id) ON DELETE SET NULL;

        RAISE NOTICE 'Foreign key fk_upload adicionada em transactions';
    END IF;
END $$;

-- ============================================
-- Verificação
-- ============================================
DO $$
BEGIN
    RAISE NOTICE 'Migration 003_uploads.sql executada com sucesso!';
    RAISE NOTICE 'Tabela: public.uploads';
    RAISE NOTICE 'Features:';
    RAISE NOTICE '  - Controle de uploads de extratos';
    RAISE NOTICE '  - Status tracking (pending, processing, done, error)';
    RAISE NOTICE '  - Foreign key para transactions (upload_id)';
    RAISE NOTICE '  - RLS habilitado';
END $$;