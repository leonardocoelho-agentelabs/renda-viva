ALTER TABLE public.users ADD COLUMN IF NOT EXISTS acesso_liberado BOOLEAN NOT NULL DEFAULT false;

UPDATE public.users SET acesso_liberado = true
WHERE lower(email) IN ('contato.agentelabs@gmail.com', 'juniordejesusoliveira557@gmail.com');
