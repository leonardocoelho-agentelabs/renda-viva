-- Adiciona campo cancelado_em para rastrear data de cancelamento da assinatura
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS cancelado_em TIMESTAMPTZ;