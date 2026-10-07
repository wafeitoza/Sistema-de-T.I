-- =============================================================================
-- Fase D — RLS por perfil (espelho de src/lib/permissions.ts)
--
-- Substitui as policies temporárias `using (true)` da Fase A. Regras:
--
--   anon          → NENHUMA tabela (só as RPCs do link de aprovação)
--   authenticated → leitura de todas as tabelas de negócio (dashboard,
--                   relatórios e combos precisam dos dados); escrita por perfil:
--                     Admin ................ tudo (inclui usuarios)
--                     Admin, Gerente ...... setores, fornecedores, solicitacoes
--                     Admin, Gerente, Técnico ... demais tabelas (podeEditar)
--                     Visualizador ........ nada
--                   auditoria: leitura só Admin/Gerente (como /auditoria),
--                   INSERT liberado para qualquer autenticado (LOGIN/LOGOUT)
--
-- service_role (Vercel Function) continua com acesso total: no Supabase ele
-- tem BYPASSRLS e recebe uma policy explícita abaixo — assim segue total
-- mesmo fora do Supabase. O SQL Editor entra como `postgres` (dono das
-- tabelas), que também não passa pelas policies.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers de perfil — SECURITY DEFINER porque a policy lê `usuarios` (senão
-- haveria recursão de RLS). O dono é o dono das tabelas, então a leitura vale.
-- -----------------------------------------------------------------------------

-- auth.uid() reescrito aqui: mesmo valor (sub do JWT), mas sem depender do
-- schema `auth` — assim as migrations rodam num Postgres puro (validação em
-- Docker/CI) e não só no Supabase.
create or replace function public.uid_requisicao()
returns uuid
language sql
stable
as $$
  select nullif(
    coalesce(
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
      nullif(current_setting('request.jwt.claim.sub', true), '')
    ),
    ''
  )::uuid;
$$;

create or replace function public.perfil_atual()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.perfil
  from public.usuarios u
  where u.auth_id = public.uid_requisicao()
  limit 1;
$$;

create or replace function public.perfil_em(p_perfis text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.perfil_atual() = any(p_perfis), false);
$$;

-- espelho exato de src/lib/permissions.ts
create or replace function public.e_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select public.perfil_em(array['Admin']) $$;

create or replace function public.pode_gerenciar()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select public.perfil_em(array['Admin', 'Gerente']) $$;

-- espelho de podeEditar(perfil) — Visualizador não escreve
create or replace function public.pode_editar()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select public.perfil_em(array['Admin', 'Gerente', 'Técnico']) $$;

-- papel da requisição, sem SECURITY DEFINER: dentro de uma função definer
-- `current_user` seria o dono. PostgREST faz SET ROLE (anon/authenticated/
-- service_role); conexão direta (SQL Editor) devolve o usuário do banco.
create or replace function public.papel_requisicao()
returns text
language sql
stable
as $$ select current_user::text $$;

create or replace function public.email_do_usuario()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.email
  from public.usuarios u
  where u.auth_id = public.uid_requisicao()
  limit 1;
$$;

-- -----------------------------------------------------------------------------
-- Zera as policies temporárias da Fase A
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'usuarios', 'setores', 'fornecedores', 'ativos', 'estoque',
    'entradas_estoque', 'saidas_estoque', 'solicitacoes', 'manutencoes',
    'contagens', 'contagem_itens', 'termos', 'movimentacoes',
    'auditoria', 'sequencias', 'emprestimos'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_acesso_geral_temporario', t);
  end loop;

  drop policy if exists auditoria_leitura_temporario on public.auditoria;
  drop policy if exists auditoria_somente_insert_temporario on public.auditoria;
  drop policy if exists sequencias_somente_leitura_temporario on public.sequencias;
end;
$$;

-- -----------------------------------------------------------------------------
-- anon: nenhum acesso direto às tabelas (defesa em profundidade — as policies
-- já negariam, mas o revoke deixa explícito e sobrevive a uma policy esquecida)
-- -----------------------------------------------------------------------------
revoke all
  on table public.usuarios, public.setores, public.fornecedores, public.ativos,
          public.estoque, public.entradas_estoque, public.saidas_estoque,
          public.solicitacoes, public.manutencoes, public.contagens,
          public.contagem_itens, public.termos, public.movimentacoes,
          public.auditoria, public.sequencias, public.emprestimos
  from anon;

-- RPCs de sequência consomem/inflam contadores: só usuário autenticado
revoke execute on function public.proxima_sequencia(text) from anon;
revoke execute on function public.reservar_sequencia(text, integer) from anon;

-- -----------------------------------------------------------------------------
-- Leitura: qualquer autenticado nas tabelas de negócio
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'usuarios', 'setores', 'fornecedores', 'ativos', 'estoque',
    'entradas_estoque', 'saidas_estoque', 'solicitacoes', 'manutencoes',
    'contagens', 'contagem_itens', 'termos', 'movimentacoes', 'emprestimos'
  ]
  loop
    execute format(
      'create policy %I on public.%I
         for select to authenticated using (true)',
      t || '_leitura', t
    );
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Escrita por perfil
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'ativos', 'estoque', 'entradas_estoque', 'saidas_estoque', 'manutencoes',
    'contagens', 'contagem_itens', 'termos', 'movimentacoes', 'emprestimos'
  ]
  loop
    execute format(
      'create policy %I on public.%I
         for all to authenticated
         using (public.pode_editar()) with check (public.pode_editar())',
      t || '_escrita', t
    );
  end loop;

  foreach t in array array['setores', 'fornecedores', 'solicitacoes']
  loop
    execute format(
      'create policy %I on public.%I
         for all to authenticated
         using (public.pode_gerenciar()) with check (public.pode_gerenciar())',
      t || '_escrita', t
    );
  end loop;
end;
$$;

-- usuarios: só Admin escreve (é o que impede auto-promoção de perfil)
create policy usuarios_escrita on public.usuarios
  for all to authenticated
  using (public.e_admin()) with check (public.e_admin());

-- auditoria: append-only no nível de policy + leitura igual a /auditoria
create policy auditoria_leitura on public.auditoria
  for select to authenticated
  using (public.pode_gerenciar());

create policy auditoria_insere on public.auditoria
  for insert to authenticated
  with check (true);

-- sequencias: leitura para montar os blocos; escrita só via RPC security definer
create policy sequencias_leitura on public.sequencias
  for select to authenticated
  using (true);

-- service_role (api/usuarios.mjs): no Supabase este papel já tem BYPASSRLS.
-- A policy explícita garante o acesso mesmo fora do Supabase (validação em
-- Docker) ou se a configuração padrão mudar — a Function não pode ficar sem
-- ler/escrever o que o app não alcança.
do $$
declare
  t text;
begin
  foreach t in array array[
    'usuarios', 'setores', 'fornecedores', 'ativos', 'estoque',
    'entradas_estoque', 'saidas_estoque', 'solicitacoes', 'manutencoes',
    'contagens', 'contagem_itens', 'termos', 'movimentacoes',
    'auditoria', 'sequencias', 'emprestimos'
  ]
  loop
    execute format(
      'create policy %I on public.%I
         for all to service_role using (true) with check (true)',
      t || '_service_role', t
    );
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Trava extra em `usuarios` — vai além do RLS para o caso de uma policy ser
-- reaberta ou de um UPDATE em massa escapar do filtro de perfil.
-- -----------------------------------------------------------------------------
create or replace function public.proteger_usuarios()
returns trigger
language plpgsql
as $$
declare
  v_papel text := public.papel_requisicao();
begin
  -- 'postgres'/'supabase_admin' = SQL Editor; 'service_role' = API
  if v_papel in ('anon', 'authenticated') then
    if not public.e_admin() then
      raise exception 'acesso negado: apenas Admin grava em public.usuarios';
    end if;
  end if;

  -- vínculo com a conta Auth nasce e morre na API (api/usuarios.mjs)
  if tg_op = 'UPDATE'
     and new.auth_id is distinct from old.auth_id
     and v_papel in ('anon', 'authenticated') then
    raise exception 'auth_id só pode ser alterado pela API de admin';
  end if;

  return new;
end;
$$;

drop trigger if exists usuarios_protegidos on public.usuarios;
create trigger usuarios_protegidos
  before insert or update on public.usuarios
  for each row execute function public.proteger_usuarios();

-- -----------------------------------------------------------------------------
-- Auditoria: o `usuario` vem do JWT quando quem grava está autenticado —
-- impede forjar o nome de outra pessoa no log (RN009). Sem vínculo (auth_id
-- nulo/divergente) o nome informado pelo cliente é descartado e vai 'sistema'.
-- Dentro de função security definer (RPC do link de aprovação) o papel não é
-- `authenticated`, então o valor informado é mantido (é o aprovador do token).
-- -----------------------------------------------------------------------------
create or replace function public.auditoria_assina_usuario()
returns trigger
language plpgsql
as $$
begin
  if public.papel_requisicao() = 'authenticated' then
    new.usuario := coalesce(public.email_do_usuario(), 'sistema');
  end if;
  return new;
end;
$$;

drop trigger if exists auditoria_assinada on public.auditoria;
create trigger auditoria_assinada
  before insert on public.auditoria
  for each row execute function public.auditoria_assina_usuario();
