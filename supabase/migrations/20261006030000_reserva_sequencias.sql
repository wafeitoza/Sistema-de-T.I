-- Reserva de sequência em bloco.
-- O app gera IDs de forma síncrona (proximaSequencia), então precisa consumir
-- um bloco localmente e buscar outro antes de esgotar — evita ID duplicado
-- quando dois usuários criam registros ao mesmo tempo.
create or replace function public.reservar_sequencia(p_nome text, p_qtd integer default 50)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_topo integer;
begin
  if p_nome is null or btrim(p_nome) = '' then
    raise exception 'nome de sequência vazio';
  end if;
  if p_qtd is null or p_qtd < 1 or p_qtd > 1000 then
    raise exception 'quantidade de reserva inválida (1..1000)';
  end if;

  insert into public.sequencias (nome, valor)
  values (p_nome, p_qtd)
  on conflict (nome)
    do update set valor = public.sequencias.valor + p_qtd,
                  atualizado_em = now()
  returning valor into v_topo;

  -- devolve o topo do bloco: este cliente pode usar (v_topo - p_qtd + 1) .. v_topo
  return v_topo;
end;
$$;

revoke all on function public.reservar_sequencia(text, integer) from public;
grant execute on function public.reservar_sequencia(text, integer) to anon, authenticated, service_role;

comment on function public.reservar_sequencia(text, integer) is
  'Reserva p_qtd valores de uma sequência e devolve o topo do bloco';
