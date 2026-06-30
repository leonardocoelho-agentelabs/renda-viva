-- Controle de deduplicação do evento Purchase do Meta (Conversions API).
-- Marca se o evento Purchase já foi enviado para uma assinatura, evitando
-- disparos duplicados em renovações mensais futuras.
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS purchase_event_enviado BOOLEAN DEFAULT FALSE;
