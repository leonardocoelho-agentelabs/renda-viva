-- Tabela de compromissos financeiros recorrentes
CREATE TABLE recurring_commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identificação
  nome VARCHAR(200) NOT NULL,
  descricao VARCHAR(500),
  categoria VARCHAR(100) NOT NULL DEFAULT 'Assinaturas',

  -- Tipo
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('assinatura', 'parcela')),

  -- Valores
  valor DECIMAL(12,2) NOT NULL,
  dia_vencimento INTEGER NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),

  -- Campos exclusivos de PARCELA
  total_parcelas INTEGER,           -- ex: 12
  parcelas_pagas INTEGER DEFAULT 0, -- ex: 3 (já pagou)
  parcelas_restantes INTEGER        -- calculado: total - pagas
    GENERATED ALWAYS AS (
      CASE WHEN tipo = 'parcela'
        THEN total_parcelas - parcelas_pagas
        ELSE NULL
      END
    ) STORED,

  -- Datas
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim DATE,  -- NULL = assinatura sem prazo; preenchido automaticamente para parcelas

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'ativo'
    CHECK (status IN ('ativo', 'cancelado', 'concluido')),
  cancelado_em TIMESTAMPTZ,

  -- Alertas
  alerta_dias_antes INTEGER NOT NULL DEFAULT 3,
  alerta_whatsapp BOOLEAN NOT NULL DEFAULT true,

  -- Controle
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_recurring_user ON recurring_commitments(user_id);
CREATE INDEX idx_recurring_status ON recurring_commitments(user_id, status);
CREATE INDEX idx_recurring_vencimento ON recurring_commitments(dia_vencimento);

-- RLS
ALTER TABLE recurring_commitments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_commitments" ON recurring_commitments
  FOR ALL USING (auth.uid() = user_id);

-- Trigger para calcular data_fim das parcelas automaticamente
CREATE OR REPLACE FUNCTION calc_data_fim_parcela()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tipo = 'parcela' AND NEW.total_parcelas IS NOT NULL THEN
    NEW.data_fim := NEW.data_inicio +
      ((NEW.total_parcelas - NEW.parcelas_pagas) * INTERVAL '1 month');
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calc_data_fim
  BEFORE INSERT OR UPDATE ON recurring_commitments
  FOR EACH ROW EXECUTE FUNCTION calc_data_fim_parcela();