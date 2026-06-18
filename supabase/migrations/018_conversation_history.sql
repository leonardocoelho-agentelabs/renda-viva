-- Migration 018: Conversation History - Histórico Persistido de Conversas

CREATE TABLE conversation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL DEFAULT gen_random_uuid(),
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conv_user_session ON conversation_history(user_id, session_id, created_at);
CREATE INDEX idx_conv_user_recent ON conversation_history(user_id, created_at DESC);

ALTER TABLE conversation_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_history" ON conversation_history
  FOR ALL USING (auth.uid() = user_id);