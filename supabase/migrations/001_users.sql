-- ============================================
-- Migration: 001_users.sql
-- Tabela de perfil de usuários
-- Complementa auth.users do Supabase
-- ============================================

-- 1. Criar tabela de perfis de usuário
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    renda_mensal NUMERIC(10, 2) DEFAULT 0,
    perfil_risco TEXT DEFAULT 'moderado' CHECK (perfil_risco IN ('conservador', 'moderado', 'agressivo')),
    modo_crise BOOLEAN DEFAULT false,
    score_saude INTEGER DEFAULT 0 CHECK (score_saude >= 0 AND score_saude <= 100),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Criar função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Criar trigger para updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 4. Criar função para criar perfil automaticamente ao registrar usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Criar trigger para auto-criar perfil
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 6. Habilitar RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 7. Criar políticas RLS
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile"
    ON public.users FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile"
    ON public.users FOR UPDATE
    USING (auth.uid() = id);

-- 8. Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.users TO authenticated;

-- ============================================
-- Verificação
-- ============================================
DO $$
BEGIN
    RAISE NOTICE 'Migration 001_users.sql executada com sucesso!';
    RAISE NOTICE 'Tabela: public.users';
    RAISE NOTICE 'Features:';
    RAISE NOTICE '  - Auto-criação de perfil ao registrar usuário';
    RAISE NOTICE '  - Trigger para updated_at automático';
    RAISE NOTICE '  - RLS habilitado (usuário só acessa próprio registro)';
END $$;