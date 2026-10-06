-- Fase C: ligação entre o perfil do app e a conta no Supabase Auth.
-- A API (Vercel Function `api/usuarios.mjs`) usa este id para redefinir
-- a senha ou excluir a conta. O navegador NUNCA escreve esta coluna.
alter table public.usuarios add column if not exists auth_id uuid;

create unique index if not exists usuarios_auth_id_key
  on public.usuarios (auth_id);

comment on column public.usuarios.auth_id is
  'id do usuário em auth.users (preenchido apenas pela API de admin)';
