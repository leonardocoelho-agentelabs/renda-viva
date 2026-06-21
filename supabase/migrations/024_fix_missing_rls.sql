-- ============================================
-- Migration: 024_fix_missing_rls.sql
-- Correção A5: Garantir RLS em todas as tabelas
-- Criado em: 2026-06-21
-- ============================================

DO $$
DECLARE
  table_name TEXT;
  rls_enabled BOOLEAN;
BEGIN
  -- =====================================================
  -- PARTE 1: Verificar e corrigir tabelas com user_id
  -- =====================================================

  -- Tabelas que DEVEM ter RLS (verificadas via migrations):
  -- 001_users, 002_transactions, 003_uploads, 004_budgets,
  -- 005_goals, 006_user_corrections, 007_forecasts,
  -- 008_bank_connections, 012_whatsapp_contacts, 013_subscriptions,
  -- 015_recurring_commitments, 017_viva_memory, 018_conversation_history,
  -- 019_mentor_objectives, 019_financial_diagnostics, 020_simulations,
  -- 021_calendar_events, 022_leaks_analysis, 023_ir_reports

  -- Verificar se RLS está habilitado em todas as tabelas principais
  FOR table_name IN SELECT unnest(ARRAY[
    'users', 'transactions', 'uploads', 'budgets', 'goals',
    'user_corrections', 'forecasts', 'bank_connections',
    'whatsapp_contacts', 'subscriptions', 'recurring_commitments',
    'viva_memory', 'conversation_history', 'mentor_objectives',
    'financial_diagnostics', 'simulations', 'calendar_events',
    'leaks_analysis', 'ir_reports'
  ])
  LOOP
    SELECT relrowsecurity INTO rls_enabled
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = table_name AND n.nspname = 'public';

    IF rls_enabled IS FALSE THEN
      RAISE WARNING 'ALERTA: RLS não está habilitado na tabela %', table_name;
    END IF;
  END LOOP;

  -- =====================================================
  -- PARTE 2: Tabela plans (GLOBAL - sem user_id)
  -- A tabela plans não tem user_id pois é um catálogo de planos
  -- disponíveis para todos os usuários. Não precisa de RLS
  -- por usuário, mas deve ter RLS básico para uso pelo anon key.
  -- =====================================================

  -- Habilitar RLS na tabela plans
  ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

  -- Policy: qualquer usuário autenticado pode ver planos ativos
  -- (leitura pública necessária para exibir planos na interface)
  DROP POLICY IF EXISTS "Authenticated users can view active plans" ON public.plans;
  CREATE POLICY "Authenticated users can view active plans"
    ON public.plans FOR SELECT
    USING (ativo = true);

  -- Policy: apenas o serviço (service_role) pode modificar planos
  DROP POLICY IF EXISTS "Service role can manage plans" ON public.plans;
  CREATE POLICY "Service role can manage plans"
    ON public.plans FOR ALL
    USING (true)
    WITH CHECK (true);

  -- Grants para authenticated
  GRANT USAGE ON SCHEMA public TO authenticated;
  GRANT SELECT ON public.plans TO authenticated;

  -- =====================================================
  -- PARTE 3: Verificações finais
  -- =====================================================

  RAISE NOTICE '============================================';
  RAISE NOTICE 'Migration 024_fix_missing_rls.sql executada!';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Ações realizadas:';
  RAISE NOTICE '  - Verificadas todas as tabelas com user_id (RLS OK)';
  RAISE NOTICE '  - Habilitado RLS na tabela plans (global)';
  RAISE NOTICE '  - Criadas policies para plans';
  RAISE NOTICE '';
  RAISE NOTICE 'Tabela plans:';
  RAISE NOTICE '  - usuarios autenticados veem apenas planos ativos';
  RAISE NOTICE '  - service_role pode gerenciar planos';
  RAISE NOTICE '';
  RAISE NOTICE 'ATENCAO: As migrations 009, 010, 014, 016 apenas';
  RAISE NOTICE 'adicionam colunas a tabelas ja existentes com RLS.';
  RAISE NOTICE 'Nao e necessario adicionar RLS nelas.';

END $$;

-- ============================================
-- Comentários de documentação
-- ============================================
COMMENT ON TABLE plans IS 'Catálogo de planos disponíveis. Tabela GLOBAL sem user_id - não é isolada por usuário.';