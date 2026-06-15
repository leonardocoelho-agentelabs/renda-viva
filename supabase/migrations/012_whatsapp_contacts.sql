CREATE TABLE IF NOT EXISTS public.whatsapp_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  telefone TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_telefone ON public.whatsapp_contacts(telefone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_user_id ON public.whatsapp_contacts(user_id);

ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own whatsapp contacts" ON public.whatsapp_contacts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own whatsapp contacts" ON public.whatsapp_contacts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own whatsapp contacts" ON public.whatsapp_contacts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own whatsapp contacts" ON public.whatsapp_contacts
  FOR DELETE USING (auth.uid() = user_id);

-- Migrar número já cadastrado em users.telefone (se houver)
INSERT INTO public.whatsapp_contacts (user_id, telefone, nome)
SELECT id, telefone, COALESCE(split_part(full_name, ' ', 1), 'Eu')
FROM public.users
WHERE telefone IS NOT NULL AND telefone != ''
ON CONFLICT (telefone) DO NOTHING;

-- Rastrear quem registrou a transação
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS registrado_por TEXT;