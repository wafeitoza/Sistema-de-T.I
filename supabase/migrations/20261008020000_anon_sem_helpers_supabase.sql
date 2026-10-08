-- =============================================================================
-- Fase D (hardening 2) — o default privileges do Supabase devolve o anon
--
-- A migration anterior (20261008010000) revogou o EXECUTE de `PUBLIC`, o que
-- bastava em Postgres puro (é o único caminho que existe lá). No Supabase,
-- porém, o schema `public` tem um ALTER DEFAULT PRIVILEGES de `supabase_admin`
-- concedendo `execute` a `anon`, `authenticated` e `service_role`
-- (pg_default_acl, objeto 'f'). Esse grant é DIRETO, escrito em
-- pg_proc.proacl na criação da função — não passa por `PUBLIC`, sobreviveu ao
-- revoke anterior e o `anon` continuava chamando `perfil_atual()` pelo
-- PostgREST (HTTP 200, devolvendo null/false — sem vazamento, mas fora da
-- regra da Fase D).
--
-- Correção: revogar de `public` E de `anon` e reafirmar o grant para os papéis
-- que as policies realmente usam. `postgres` (dono / SQL Editor) fica com o
-- grant direto que o default ACL já deu.
--
-- Vale para o resto do projeto: em Supabase TODA função nova nasce executável
-- por `anon` — toda RPC precisa de revoke explícito de quem não deve chamá-la.
-- =============================================================================

do $$
declare
  r record;
begin
  for r in
    select p.proname,
           pg_get_function_identity_arguments(p.oid) as args
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in (
         'uid_requisicao', 'perfil_atual', 'perfil_em', 'e_admin',
         'pode_gerenciar', 'pode_editar', 'papel_requisicao', 'email_do_usuario'
       )
  loop
    execute format(
      'revoke execute on function public.%I(%s) from public, anon',
      r.proname, r.args
    );
    execute format(
      'grant execute on function public.%I(%s) to authenticated, service_role',
      r.proname, r.args
    );
  end loop;
end;
$$;
