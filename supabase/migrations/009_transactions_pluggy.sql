-- ============================================
-- Migration: 009_transactions_pluggy.sql
-- Coluna para deduplicação de transações vindas do Open Finance (Pluggy)
-- ============================================

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS pluggy_transaction_id TEXT;

-- Constraint UNIQUE (NULLs são permitidos e distintos no Postgres, então
-- transações manuais/CSV com pluggy_transaction_id NULL não são afetadas).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_transactions_pluggy_tx_id'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT uq_transactions_pluggy_tx_id UNIQUE (pluggy_transaction_id);
  END IF;
END $$;
