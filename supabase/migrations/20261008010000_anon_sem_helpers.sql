-- =============================================================================
-- Fase D (hardening) — helpers de policy não ficam executáveis para `anon`
--
-- `create or replace function` concede EXECUTE a `PUBLIC` por padrão, então o
-- papel `anon` conseguia chamar `perfil_atual()`, `e_admin()`, `pode_editar()`
-- etc. pelo PostgREST. Elas devolvem null/false/'anon' para quem não tem JWT
-- (não há vazamento), mas a regra da Fase D é explícita: o `anon` só enxerga
-- as duas RPCs do link de aprovação.
--
-- O revoke é de `PUBLIC` (revogar só de `anon` não adianta: o caminho via
-- PUBLIC continua valendo) e o grant volta para `authenticated` e
-- `service_role` — as policies rodam com o papel da requisição e precisam
-- delas; sem esse grant Toda escrita seria negada. O SQL Editor entra como
-- `postgres`, que não passa por policy e por isso não precisa do grant.
--
-- As duas RPCs do link ficam de fora: continuam com `grant ... to anon`.
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
      'revoke execute on function public.%I(%s) from public',
      r.proname, r.args
    );
    execute format(
      'grant execute on function public.%I(%s) to authenticated, service_role',
      r.proname, r.args
    );
  end loop;
end;
$$;
