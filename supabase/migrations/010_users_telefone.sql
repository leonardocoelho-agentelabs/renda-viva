ALTER TABLE public.users ADD COLUMN IF NOT EXISTS telefone TEXT;
CREATE INDEX IF NOT EXISTS idx_users_telefone ON public.users(telefone);
