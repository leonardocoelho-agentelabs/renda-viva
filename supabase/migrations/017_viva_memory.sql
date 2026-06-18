-- Migration 017: Viva Memory - Memória Financeira de Longo Prazo

CREATE TABLE viva_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Tipo de memória
  tipo VARCHAR(50) NOT NULL CHECK (tipo IN (
    'objetivo_vida',      -- "quero comprar uma casa"
    'decisao_importante', -- "decidiu não parcelar o carro"
    'conquista',          -- "atingiu meta de reserva"
    'comportamento',      -- "tende a gastar mais às sextas"
    'preferencia',        -- "prefere investimentos conservadores"
    'contexto_pessoal',   -- "tem 2 filhos", "é freelancer"
    'alerta_recorrente'   -- padrão problemático detectado
  )),

  -- Conteúdo
  titulo VARCHAR(200) NOT NULL,
  conteudo TEXT NOT NULL,

  -- Relevância
  importancia INTEGER DEFAULT 5 CHECK (importancia BETWEEN 1 AND 10),

  -- Controle
  ativo BOOLEAN DEFAULT true,
  ultima_referencia TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_viva_memory_user ON viva_memory(user_id, ativo);
CREATE INDEX idx_viva_memory_tipo ON viva_memory(user_id, tipo);

ALTER TABLE viva_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_memory" ON viva_memory
  FOR ALL USING (auth.uid() = user_id);