-- =============================================================================
-- Fase A — Privilégios e RLS
-- O RLS é ligado AGORA (nunca com tabela exposta sem policy), com uma política
-- ampla temporária para a Fase B funcionar com a anon key.
-- A Fase D SUBSTITUI estas policies por espelho de src/lib/permissions.ts
-- (Admin/Gerente/Técnico/Visualizador). Enquanto isso, dado real não é para
-- produção — ver PLANO-IMPLANTACAO.md.
-- =============================================================================

-- Supabase: papéis padrão com acesso ao schema public
grant usage on schema public to anon, authenticated, service_role;

do $$
declare
  t text;
begin
  foreach t in array array[
    'usuarios', 'setores', 'fornecedores', 'ativos', 'estoque',
    'entradas_estoque', 'saidas_estoque', 'solicitacoes', 'manutencoes',
    'contagens', 'contagem_itens', 'termos', 'movimentacoes',
    'auditoria', 'sequencias'
  ]
  loop
    execute format('grant select, insert, update, delete on public.%I to anon, authenticated, service_role', t);
    execute format('alter table public.%I enable row level security', t);
    -- TEMPORÁRIO (Fase B) — substituir na Fase D por policies por perfil
    execute format(
      'create policy "%s_acesso_geral_temporario" on public.%I
         for all to anon, authenticated, service_role
         using (true) with check (true)',
      t, t
    );
  end loop;
end;
$$;

-- auditoria: append-only também no nível de policy (leitura + INSERT, sem UPDATE/DELETE)
drop policy if exists auditoria_acesso_geral_temporario on public.auditoria;
create policy auditoria_leitura_temporario on public.auditoria
  for select to anon, authenticated, service_role
  using (true);
create policy auditoria_somente_insert_temporario on public.auditoria
  for insert to anon, authenticated, service_role
  with check (true);

-- sequencias: escrita só via proxima_sequencia() (security definer)
drop policy if exists sequencias_acesso_geral_temporario on public.sequencias;
create policy sequencias_somente_leitura_temporario on public.sequencias
  for select to anon, authenticated, service_role
  using (true);
