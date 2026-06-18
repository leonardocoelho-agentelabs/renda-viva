CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identificação
  titulo VARCHAR(200) NOT NULL,
  descricao TEXT,

  -- Tipo do evento
  tipo VARCHAR(30) NOT NULL CHECK (tipo IN (
    'vencimento_recorrente',  -- vem de recurring_commitments
    'transacao_prevista',     -- previsto pela IA
    'salario',                -- receita recorrente detectada
    'meta_aporte',            -- aporte mensal de meta
    'alerta'                  -- alerta financeiro
  )),

  -- Valores
  valor DECIMAL(12,2),

  -- Data
  data_evento DATE NOT NULL,

  -- Referências
  recurring_commitment_id UUID REFERENCES recurring_commitments(id)
    ON DELETE CASCADE,
  goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,

  -- Status
  pago BOOLEAN DEFAULT false,
  pago_em TIMESTAMPTZ,

  -- Controle
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_calendar_user_data
  ON calendar_events(user_id, data_evento);
CREATE INDEX idx_calendar_user_mes
  ON calendar_events(user_id, data_evento, tipo);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_calendar" ON calendar_events
  FOR ALL USING (auth.uid() = user_id);
