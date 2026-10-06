-- =============================================================================
-- Fase A — Auditoria append-only (RN009)
-- A tabela auditoria só aceita INSERT.
--   * UPDATE/DELETE por linha são bloqueados por trigger.
--   * TRUNCATE continua permitido (nível de instrução): é o caminho usado pela
--     restauração de backup/importação, que regrava a coleção inteira.
-- =============================================================================

create or replace function public.bloquear_reescrita_auditoria()
returns trigger
language plpgsql
as $$
begin
  raise exception 'auditoria é append-only: % não é permitido em public.auditoria', tg_op
    using hint = 'Use TRUNCATE para regravar a coleção inteira (restauração de backup).';
end;
$$;

create trigger auditoria_sem_update_delete
  before update or delete on public.auditoria
  for each row execute function public.bloquear_reescrita_auditoria();

-- -----------------------------------------------------------------------------
-- atualizado_em — carimbo automático (a coluna existe em toda tabela editável)
-- =============================================================================
create or replace function public.marcar_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'usuarios', 'setores', 'fornecedores', 'ativos', 'estoque',
    'solicitacoes', 'manutencoes', 'contagens', 'termos', 'movimentacoes'
  ]
  loop
    execute format(
      'create trigger %I before update on public.%I
         for each row execute function public.marcar_atualizado_em()',
      t || '_marca_atualizado', t
    );
  end loop;
end;
$$;
