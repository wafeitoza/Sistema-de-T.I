-- =============================================================================
-- Fase A — Sequências
-- Substituem as chaves ITSTOCK_SEQ_* do localStorage.
-- Mesmo contrato da função proximaSequencia() do app: devolve o próximo número
-- (a tabela começa em 0 e a primeira chamada devolve 1).
-- =============================================================================

create or replace function public.proxima_sequencia(p_nome text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proximo integer;
begin
  if p_nome is null or btrim(p_nome) = '' then
    raise exception 'nome de sequência vazio';
  end if;

  insert into public.sequencias (nome, valor)
  values (p_nome, 1)
  on conflict (nome)
    do update set valor = public.sequencias.valor + 1,
                  atualizado_em = now()
  returning valor into v_proximo;

  return v_proximo;
end;
$$;

revoke all on function public.proxima_sequencia(text) from public;
grant execute on function public.proxima_sequencia(text) to anon, authenticated, service_role;

-- Sequências que o app usa hoje (backup.ts / stores)
insert into public.sequencias (nome, valor) values
  ('EDD', 0), ('INV', 0), ('LOG', 0), ('MAN', 0), ('SAD', 0),
  ('SOL', 0), ('TERM', 0), ('SET', 0), ('FOR', 0), ('MOV', 0)
on conflict (nome) do nothing;
