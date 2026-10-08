-- =============================================================================
-- Teste comportamental de RLS — Fase D (supabase/tests/rls_fase_d.sql)
--
-- Confere, com dados reais, o que as migrations da Fase D garantem:
--   * anon            -> nenhuma tabela; só as RPCs do link de aprovação
--   * authenticated   -> leitura geral, escrita por perfil (espelho de
--                        src/lib/permissions.ts), sem auto-promoção de perfil
--   * auditoria       -> append-only e assinada com o e-mail do JWT
--   * service_role    -> acesso total (Vercel Function)
--
-- Como rodar (banco DESCARTÁVEL — o script cria tabelas/funções de teste):
--
--   docker run -d --name pg-rls -e POSTGRES_PASSWORD=postgres postgres:17-alpine
--   for i in $(seq 1 30); do docker exec pg-rls pg_isready -U postgres && break; done
--   docker exec -i pg-rls psql -U postgres -c 'create database itstock'
--   docker exec -i pg-rls psql -U postgres \
--     -c 'create role anon nologin' \
--     -c 'create role authenticated nologin' \
--     -c 'create role service_role nologin bypassrls'
--   for f in supabase/migrations/*.sql; do
--     docker exec -i pg-rls psql -U postgres -d itstock -v ON_ERROR_STOP=1 < "$f"
--   done
--   docker exec -i pg-rls psql -U postgres -d itstock -v ON_ERROR_STOP=1 \
--     < supabase/tests/rls_fase_d.sql
--
-- Saída esperada: relatório com `fail = 0` (as linhas FAIL saem primeiro).
-- =============================================================================

-- papéis do Supabase (já existem lá; aqui são criados para o Docker puro)
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

create table if not exists public.rls_resultados (
  ordem    serial,
  descricao text,
  ok       boolean,
  detalhe  text
);
truncate public.rls_resultados;

grant select, insert on public.rls_resultados to anon, authenticated, service_role;
grant usage, select on sequence public.rls_resultados_ordem_seq
  to anon, authenticated, service_role;

-- funcoes SEM security definer: precisam executar o comando com o papel atual
create or replace function public.rls_checar(p_desc text, p_sql text, p_deve_funcionar boolean)
returns void language plpgsql as $fn$
begin
  begin
    execute p_sql;
    insert into public.rls_resultados (descricao, ok, detalhe)
      values (p_desc, p_deve_funcionar, 'executou sem erro');
  exception when others then
    insert into public.rls_resultados (descricao, ok, detalhe)
      values (p_desc, not p_deve_funcionar, sqlerrm);
  end;
end $fn$;

create or replace function public.rls_checar_valor(p_desc text, p_sql text, p_esperado text)
returns void language plpgsql as $fn$
declare v_valor text;
begin
  begin
    execute p_sql into v_valor;
    insert into public.rls_resultados (descricao, ok, detalhe)
      values (p_desc, v_valor is not distinct from p_esperado,
              'valor: ' || coalesce(v_valor, 'NULL'));
  exception when others then
    insert into public.rls_resultados (descricao, ok, detalhe)
      values (p_desc, false, sqlerrm);
  end;
end $fn$;

create or replace function public.rls_checar_linhas(p_desc text, p_sql text, p_esperado integer)
returns void language plpgsql as $fn$
declare v_qtd integer;
begin
  begin
    execute p_sql into v_qtd;
    insert into public.rls_resultados (descricao, ok, detalhe)
      values (p_desc, v_qtd = p_esperado, 'linhas: ' || coalesce(v_qtd::text, 'NULL'));
  exception when others then
    insert into public.rls_resultados (descricao, ok, detalhe)
      values (p_desc, false, sqlerrm);
  end;
end $fn$;

-- -----------------------------------------------------------------------------
-- dados base
-- -----------------------------------------------------------------------------
insert into public.usuarios (email, nome, perfil, auth_id) values
  ('admin@empresa.com', 'Ana Admin', 'Admin', '11111111-1111-1111-1111-111111111111'),
  ('ger@empresa.com',   'Gil Gerente', 'Gerente', '22222222-2222-2222-2222-222222222222'),
  ('tec@empresa.com',   'Tia Tecnica', 'Técnico', '33333333-3333-3333-3333-333333333333'),
  ('vis@empresa.com',   'Vera Visual', 'Visualizador', '44444444-4444-4444-4444-444444444444');

insert into public.ativos (codigo, descricao, tipo, setor, responsavel, data_aquisicao, qr_url)
values ('NTB-001', 'Notebook Dell', 'Notebook', 'TI', 'Tia Tecnica', '2026-01-10', 'x');

insert into public.solicitacoes
  (id, data, solicitante, tipo, descricao, prioridade, status, aprovador, aprovacao_token, token_expira_em)
values
  ('SOL-2026-000001', '2026-10-01', 'ger@empresa.com', 'Novo Ativo', 'Notebook para estagio',
   'Alta', 'Enviada', 'ana@empresa.com', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', now() + interval '7 days'),
  ('SOL-2026-000002', '2026-09-01', 'ger@empresa.com', 'Reparo', 'Monitor com defeito',
   'Normal', 'Enviada', 'ana@empresa.com', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', now() - interval '1 day'),
  ('SOL-2026-000003', '2026-10-01', 'ger@empresa.com', 'Outro', 'Ja decidida',
   'Baixa', 'Aprovada', 'ana@empresa.com', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', now() + interval '7 days');

-- =============================================================================
-- 1. anon: nenhuma tabela — só as RPCs do link de aprovação
-- =============================================================================
do $$
begin
  perform set_config('role', 'anon', false);
  perform set_config('request.jwt.claims', '', false);

  perform public.rls_checar('anon: SELECT ativos bloqueado',
    'select count(*) from public.ativos', false);
  perform public.rls_checar('anon: SELECT usuarios bloqueado',
    'select count(*) from public.usuarios', false);
  perform public.rls_checar('anon: SELECT solicitacoes bloqueado',
    'select count(*) from public.solicitacoes', false);
  perform public.rls_checar('anon: SELECT auditoria bloqueado',
    'select count(*) from public.auditoria', false);
  perform public.rls_checar('anon: SELECT sequencias bloqueado',
    'select count(*) from public.sequencias', false);
  perform public.rls_checar('anon: proxima_sequencia bloqueada',
    'select public.proxima_sequencia(''SOL'')', false);
  perform public.rls_checar('anon: reservar_sequencia bloqueada',
    'select public.reservar_sequencia(''SOL'', 10)', false);
  -- helpers de policy: sem EXECUTE para anon (revoke de PUBLIC na migration
  -- 20261008010000) — elas só devolvem null/false, mas o anon não as enxerga
  perform public.rls_checar('anon: perfil_atual bloqueada',
    'select public.perfil_atual()', false);
  perform public.rls_checar('anon: e_admin bloqueada',
    'select public.e_admin()', false);
  perform public.rls_checar('anon: pode_editar bloqueada',
    'select public.pode_editar()', false);
  perform public.rls_checar('anon: papel_requisicao bloqueada',
    'select public.papel_requisicao()', false);
  perform public.rls_checar('anon: INSERT em ativos bloqueado',
    'insert into public.ativos (codigo, descricao, tipo, setor, responsavel, data_aquisicao, qr_url)
     values (''NBX-999'', ''x'', ''Notebook'', ''TI'', ''x'', ''2026-01-01'', ''x'')', false);
  perform public.rls_checar('anon: INSERT em auditoria bloqueado',
    'insert into public.auditoria (id, usuario, acao, tabela, registro_id)
     values (''LOGT-ANON'', ''x'', ''LOGIN'', ''USUARIOS'', ''x'')', false);

  perform public.rls_checar('anon: RPC solicitacao_por_token liberada',
    'select public.solicitacao_por_token(''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'')::text', true);
  perform public.rls_checar_linhas('anon: RPC devolve NULL para token inexistente',
    'select case when public.solicitacao_por_token(''99999999-9999-4999-8999-999999999999'')
                 is null then 0 else 1 end', 0);

  perform set_config('role', 'postgres', false);
end $$;

-- =============================================================================
-- 2. anon decide pelo token (RN004)
-- =============================================================================
do $$
begin
  perform set_config('role', 'anon', false);
  perform set_config('request.jwt.claims', '', false);

  perform public.rls_checar_valor('anon: aprovar token valido',
    'select public.decidir_por_token(''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'', ''aprovar'') ->> ''ok''',
    'true');
  perform public.rls_checar_valor('anon: segunda decisao e recusada',
    'select public.decidir_por_token(''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'', ''rejeitar'', ''x'') ->> ''ok''',
    'false');
  perform public.rls_checar_valor('anon: token expirado e recusado',
    'select public.decidir_por_token(''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'', ''aprovar'') ->> ''ok''',
    'false');
  perform public.rls_checar_valor('anon: ja decidida e recusada',
    'select public.decidir_por_token(''cccccccc-cccc-4ccc-8ccc-cccccccccccc'', ''aprovar'') ->> ''ok''',
    'false');
  perform public.rls_checar_valor('anon: rejeitar sem motivo e recusado',
    'select public.decidir_por_token(''99999999-9999-4999-8999-999999999999'', ''rejeitar'', ''  '') ->> ''ok''',
    'false');
  perform public.rls_checar_valor('anon: acao desconhecida e recusada',
    'select public.decidir_por_token(''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'', ''deletar'') ->> ''ok''',
    'false');

  perform set_config('role', 'postgres', false);
  perform set_config('request.jwt.claims', '', false);

  -- leitura da consequencia como postgres (anon nao enxerga as tabelas)
  perform public.rls_checar_linhas('apos decisao: status virou Aprovada',
    'select case when (select status from public.solicitacoes where id = ''SOL-2026-000001'')
                 = ''Aprovada'' then 0 else 1 end', 0);
  perform public.rls_checar_linhas('apos decisao: auditoria gravada pela RPC',
    'select case when exists (select 1 from public.auditoria
                              where registro_id = ''SOL-2026-000001'') then 0 else 1 end', 0);
  perform public.rls_checar_valor('apos decisao: auditoria registrou o aprovador',
    'select usuario from public.auditoria where registro_id = ''SOL-2026-000001''',
    'ana@empresa.com');
  perform public.rls_checar_valor('apos decisao: mensagem identifica o link',
    'select mensagem from public.auditoria where registro_id = ''SOL-2026-000001''',
    'Decisão via link assinado (aprovar)');
end $$;

-- =============================================================================
-- 3. authenticated sem vinculo: le sim, escreve nao, nao forja log
-- =============================================================================
do $$
begin
  perform set_config('role', 'authenticated', false);
  perform set_config('request.jwt.claims',
    '{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}', false);

  perform public.rls_checar('sem vinculo: SELECT ativos liberado',
    'select count(*) from public.ativos', true);
  perform public.rls_checar('sem vinculo: SELECT usuarios liberado',
    'select count(*) from public.usuarios', true);
  -- as policies chamam estas helpers como o papel da requisição: o revoke do
  -- PUBLIC não pode ter tirado o EXECUTE delas de authenticated
  perform public.rls_checar('sem vinculo: perfil_atual executavel',
    'select public.perfil_atual()', true);
  perform public.rls_checar('sem vinculo: pode_editar executavel',
    'select public.pode_editar()', true);
  perform public.rls_checar('sem vinculo: INSERT em ativos bloqueado',
    'insert into public.ativos (codigo, descricao, tipo, setor, responsavel, data_aquisicao, qr_url)
     values (''NBX-998'', ''x'', ''Notebook'', ''TI'', ''x'', ''2026-01-01'', ''x'')', false);
  perform public.rls_checar('sem vinculo: INSERT em usuarios bloqueado',
    'insert into public.usuarios (email, nome, perfil)
     values (''hack@empresa.com'', ''Hacker'', ''Admin'')', false);
  perform public.rls_checar('sem vinculo: UPDATE de perfil nao tem efeito',
    'update public.usuarios set perfil = ''Admin'' where email = ''vis@empresa.com''', true);
  perform public.rls_checar_valor('sem vinculo: perfil de vis continua Visualizador',
    'select perfil from public.usuarios where email = ''vis@empresa.com''', 'Visualizador');
  perform public.rls_checar('sem vinculo: INSERT em auditoria liberado',
    'insert into public.auditoria (id, usuario, acao, tabela, registro_id)
     values (''LOGT-01'', ''forjado@empresa.com'', ''LOGIN'', ''USUARIOS'', ''forjado'')', true);

  perform set_config('role', 'postgres', false);
  perform set_config('request.jwt.claims', '', false);

  perform public.rls_checar_valor('sem vinculo: log nao aceita nome forjado',
    'select usuario from public.auditoria where id = ''LOGT-01''', 'sistema');
  -- o dono (SQL Editor / dono das funções) continua conseguindo chamá-las
  perform public.rls_checar('postgres: perfil_atual executavel',
    'select public.perfil_atual()', true);
end $$;

-- =============================================================================
-- 4. perfil Tecnico (vinculado)
-- =============================================================================
do $$
begin
  perform set_config('role', 'authenticated', false);
  perform set_config('request.jwt.claims',
    '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated","email":"tec@empresa.com"}', false);

  perform public.rls_checar('tecnico: INSERT em ativos liberado',
    'insert into public.ativos (codigo, descricao, tipo, setor, responsavel, data_aquisicao, qr_url)
     values (''NTB-002'', ''Notebook Lenovo'', ''Notebook'', ''TI'', ''Tia Tecnica'', ''2026-02-01'', ''x'')', true);
  perform public.rls_checar('tecnico: UPDATE em ativos liberado',
    'update public.ativos set marca = ''Lenovo'' where codigo = ''NTB-002''', true);
  perform public.rls_checar_valor('tecnico: alteracao de ativo gravada',
    'select marca from public.ativos where codigo = ''NTB-002''', 'Lenovo');
  perform public.rls_checar('tecnico: INSERT em solicitacoes bloqueado',
    'insert into public.solicitacoes (id, data, solicitante, tipo, descricao, prioridade, aprovador, status)
     values (''SOL-2026-000999'', ''2026-10-05'', ''tec'', ''Outro'', ''x'', ''Baixa'', ''ana@empresa.com'', ''Rascunho'')', false);
  perform public.rls_checar('tecnico: INSERT em setores bloqueado',
    'insert into public.setores (id, nome) values (''SET-999'', ''Hack'')', false);
  perform public.rls_checar('tecnico: INSERT em usuarios bloqueado (auto-promocao)',
    'insert into public.usuarios (email, nome, perfil, auth_id)
     values (''hack2@empresa.com'', ''Outro'', ''Admin'', ''33333333-3333-3333-3333-333333333333'')', false);
  perform public.rls_checar('tecnico: UPDATE de perfil nao tem efeito',
    'update public.usuarios set perfil = ''Admin'' where email = ''tec@empresa.com''', true);
  perform public.rls_checar_valor('tecnico: perfil continua Tecnico',
    'select perfil from public.usuarios where email = ''tec@empresa.com''', 'Técnico');
  perform public.rls_checar('tecnico: UPDATE de auth_id nao tem efeito',
    'update public.usuarios set auth_id = ''88888888-8888-4888-8888-888888888888''
     where email = ''tec@empresa.com''', true);
  perform public.rls_checar_valor('tecnico: auth_id preservado',
    'select auth_id::text from public.usuarios where email = ''tec@empresa.com''',
    '33333333-3333-3333-3333-333333333333');
  perform public.rls_checar_linhas('tecnico: nao le auditoria',
    'select count(*) from public.auditoria', 0);
  perform public.rls_checar('tecnico: INSERT em auditoria liberado',
    'insert into public.auditoria (id, usuario, acao, tabela, registro_id)
     values (''LOGT-02'', ''forjado@empresa.com'', ''CREATE'', ''ATIVOS'', ''NTB-002'')', true);
  perform public.rls_checar_valor('tecnico: proxima_sequencia liberada',
    'select public.proxima_sequencia(''SEQ'')::text', '1');
  perform public.rls_checar_valor('tecnico: reservar_sequencia liberada',
    'select public.reservar_sequencia(''SEQ2'', 5)::text', '5');

  perform set_config('role', 'postgres', false);
  perform set_config('request.jwt.claims', '', false);

  perform public.rls_checar_valor('tecnico: auditoria assinada com o e-mail do JWT',
    'select usuario from public.auditoria where id = ''LOGT-02''', 'tec@empresa.com');
end $$;

-- =============================================================================
-- 5. Gerente x Visualizador
-- =============================================================================
do $$
begin
  perform set_config('role', 'authenticated', false);
  perform set_config('request.jwt.claims',
    '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","email":"ger@empresa.com"}', false);

  perform public.rls_checar('gerente: INSERT em solicitacoes liberado',
    'insert into public.solicitacoes (id, data, solicitante, tipo, descricao, prioridade, aprovador, status)
     values (''SOL-2026-000010'', ''2026-10-05'', ''ger'', ''Outro'', ''x'', ''Baixa'', ''admin@empresa.com'', ''Rascunho'')', true);
  perform public.rls_checar('gerente: INSERT em setores liberado',
    'insert into public.setores (id, nome) values (''SET-010'', ''Logistica'')', true);
  perform public.rls_checar('gerente: UPDATE de perfil nao tem efeito',
    'update public.usuarios set perfil = ''Admin'' where email = ''ger@empresa.com''', true);
  perform public.rls_checar_valor('gerente: perfil continua Gerente',
    'select perfil from public.usuarios where email = ''ger@empresa.com''', 'Gerente');
  perform public.rls_checar('gerente: le auditoria',
    'select count(*) from public.auditoria', true);

  perform set_config('request.jwt.claims',
    '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated","email":"vis@empresa.com"}', false);

  perform public.rls_checar('visualizador: SELECT ativos liberado',
    'select count(*) from public.ativos', true);
  perform public.rls_checar('visualizador: INSERT em ativos bloqueado',
    'insert into public.ativos (codigo, descricao, tipo, setor, responsavel, data_aquisicao, qr_url)
     values (''NBX-997'', ''x'', ''Notebook'', ''TI'', ''x'', ''2026-01-01'', ''x'')', false);
  perform public.rls_checar('visualizador: UPDATE em ativos nao tem efeito',
    'update public.ativos set marca = ''Hack'' where codigo = ''NTB-001''', true);
  perform public.rls_checar_valor('visualizador: marca do ativo preservada',
    'select coalesce(marca, ''(nula)'') from public.ativos where codigo = ''NTB-001''', '(nula)');
  perform public.rls_checar_linhas('visualizador: nao le auditoria',
    'select count(*) from public.auditoria', 0);

  perform set_config('role', 'postgres', false);
  perform set_config('request.jwt.claims', '', false);
end $$;

-- =============================================================================
-- 6. Admin
-- =============================================================================
do $$
begin
  perform set_config('role', 'authenticated', false);
  perform set_config('request.jwt.claims',
    '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","email":"admin@empresa.com"}', false);

  perform public.rls_checar('admin: INSERT em usuarios liberado',
    'insert into public.usuarios (email, nome, perfil)
     values (''novo2@empresa.com'', ''Novo Dois'', ''Visualizador'')', true);
  perform public.rls_checar('admin: UPDATE de perfil liberado',
    'update public.usuarios set perfil = ''Gerente'' where email = ''vis@empresa.com''', true);
  perform public.rls_checar_valor('admin: perfil alterado de fato',
    'select perfil from public.usuarios where email = ''vis@empresa.com''', 'Gerente');
  perform public.rls_checar('admin: UPDATE de auth_id bloqueado pelo trigger',
    'update public.usuarios set auth_id = ''88888888-8888-4888-8888-888888888888''
     where email = ''admin@empresa.com''', false);
  perform public.rls_checar('admin: DELETE em usuarios liberado',
    'delete from public.usuarios where email = ''novo2@empresa.com''', true);
  perform public.rls_checar('admin: INSERT em auditoria liberado',
    'insert into public.auditoria (id, usuario, acao, tabela, registro_id)
     values (''LOGT-03'', ''forjado@empresa.com'', ''EXPORT'', ''BACKUP'', ''2026-10-07'')', true);
  perform public.rls_checar_valor('admin: auditoria assinada com o e-mail do JWT',
    'select usuario from public.auditoria where id = ''LOGT-03''', 'admin@empresa.com');
  perform public.rls_checar('admin: DELETE em auditoria nao tem efeito',
    'delete from public.auditoria where id = ''LOGT-01''', true);
  perform public.rls_checar_linhas('admin: registro de auditoria preservado',
    'select count(*) from public.auditoria where id = ''LOGT-01''', 1);
  perform public.rls_checar('admin: UPDATE em auditoria nao tem efeito',
    'update public.auditoria set mensagem = ''x'' where id = ''LOGT-01''', true);
  perform public.rls_checar_valor('admin: mensagem da auditoria continua nula',
    'select coalesce(mensagem, ''(null)'') from public.auditoria where id = ''LOGT-01''', '(null)');

  perform set_config('role', 'postgres', false);
  perform set_config('request.jwt.claims', '', false);
end $$;

-- =============================================================================
-- 7. service_role (Vercel Function)
-- =============================================================================
do $$
begin
  perform set_config('role', 'service_role', false);
  perform set_config('request.jwt.claims', '', false);

  perform public.rls_checar('service: INSERT em usuarios liberado',
    'insert into public.usuarios (email, nome, perfil, auth_id)
     values (''novo@empresa.com'', ''Novo'', ''Visualizador'', null)', true);
  perform public.rls_checar('service: UPDATE de auth_id liberado',
    'update public.usuarios set auth_id = ''77777777-7777-4777-8777-777777777777''
     where email = ''novo@empresa.com''', true);
  perform public.rls_checar_valor('service: auth_id gravado',
    'select auth_id::text from public.usuarios where email = ''novo@empresa.com''',
    '77777777-7777-4777-8777-777777777777');
  perform public.rls_checar('service: UPDATE de perfil liberado',
    'update public.usuarios set perfil = ''Admin'' where email = ''novo@empresa.com''', true);
  perform public.rls_checar_valor('service: perfil gravado',
    'select perfil from public.usuarios where email = ''novo@empresa.com''', 'Admin');
  perform public.rls_checar('service: DELETE liberado',
    'delete from public.usuarios where email = ''novo@empresa.com''', true);
  perform public.rls_checar('service: SELECT auditoria liberado',
    'select count(*) from public.auditoria', true);
  perform public.rls_checar('service: INSERT em auditoria sem assinatura',
    'insert into public.auditoria (id, usuario, acao, tabela, registro_id)
     values (''LOGT-04'', ''api@empresa.com'', ''CREATE'', ''USUARIOS'', ''novo@empresa.com'')', true);
  perform public.rls_checar_valor('service: nome informado pela API preservado',
    'select usuario from public.auditoria where id = ''LOGT-04''', 'api@empresa.com');

  perform set_config('role', 'postgres', false);
end $$;

-- =============================================================================
-- relatorio
-- =============================================================================
select
  case when ok then 'PASS' else 'FAIL' end as res,
  descricao,
  detalhe
from public.rls_resultados
order by ok asc, ordem;

-- -----------------------------------------------------------------------------
-- falha o script se alguma checagem não passou (usa com -v ON_ERROR_STOP=1)
-- -----------------------------------------------------------------------------
do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from public.rls_resultados where not ok;
  if v_falhas > 0 then
    raise exception 'RLS: % checagem(ns) falharam', v_falhas;
  end if;
  raise notice 'RLS: % checagens executadas, 0 falhas',
    (select count(*) from public.rls_resultados);
end $$;

-- limpeza dos artefatos de teste
drop function public.rls_checar(text, text, boolean);
drop function public.rls_checar_valor(text, text, text);
drop function public.rls_checar_linhas(text, text, integer);
drop table public.rls_resultados;
