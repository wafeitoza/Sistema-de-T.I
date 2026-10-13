-- =============================================================================
-- Sequências de ATIVOS (por prefixo) e de itens de ESTOQUE.
--
-- Pendência da Fase C: o código do ativo (`NOTE-001`) e do item de estoque
-- (`Item-001`) eram calculados NO CLIENTE a partir do espelho em localStorage.
-- Duas pessoas abrindo o mesmo formulário geravam o mesmo código e o upsert
-- por chave primária SOBRESCREVIA o registro da outra (perda silenciosa de
-- dados). As outras 11 coleções já usavam blocos de sequência do servidor
-- (reservar_sequencia, atômica) — agora ativos e estoque entram nessa lista.
--
-- IMPORTANTE: as sequências nascem no MAIOR número já existente no banco,
-- senão o próximo notebook viraria NOTE-001 de novo e colidiria com o que já
-- está lá (mesma consequência de antes: upsert sobrescrevendo).
--
-- O mesmo gotcha de sempre: em Supabase toda função nova nasce executável por
-- `anon`. Esta migration não cria função nenhuma — só linhas em `sequencias`,
-- tabela que o `anon` nem lê (RLS da Fase D) e cuja escrita só acontece pelas
-- RPCs já revogadas do `anon`.
-- =============================================================================

do $$
declare
  v_prefixo text;
  v_nome    text;
  v_maior   integer;
begin
  for v_prefixo, v_nome in
    select * from (values
      ('NOTE', 'ATV_NOTE'), ('MON',  'ATV_MON'),  ('CPU', 'ATV_CPU'),
      ('TEC', 'ATV_TEC'),   ('MOU',  'ATV_MOU'),  ('WEB', 'ATV_WEB'),
      ('FON', 'ATV_FON'),   ('IMP',  'ATV_IMP'),  ('SCA', 'ATV_SCA'),
      ('ROT', 'ATV_ROT'),   ('SWI',  'ATV_SWI'),  ('NOB', 'ATV_NOB'),
      ('CAB', 'ATV_CAB'),   ('ADA',  'ATV_ADA')
    ) as t(prefixo, nome)
  loop
    -- "NOTE-003" → 3 ; ignora código malformado (substring devolve null)
    select coalesce(max(substring(codigo from '^' || v_prefixo || '-(\d+)$')::int), 0)
      into v_maior
      from ativos
     where codigo ~ ('^' || v_prefixo || '-\d+$');

    insert into sequencias (nome, valor)
    values (v_nome, v_maior)
    on conflict (nome)
      do update set valor = greatest(sequencias.valor, excluded.valor),
                    atualizado_em = now();
  end loop;

  -- itens de estoque: "Item-007" → 7
  select coalesce(max(substring(codigo from '^Item-(\d+)$')::int), 0)
    into v_maior
    from estoque
   where codigo ~ '^Item-\d+$';

  insert into sequencias (nome, valor)
  values ('ITEM', v_maior)
  on conflict (nome)
    do update set valor = greatest(sequencias.valor, excluded.valor),
                  atualizado_em = now();
end
$$;

-- prova do estado final: 15 sequências novas, todas >= o maior código real
select nome, valor from sequencias
 where nome like 'ATV\_%' or nome = 'ITEM'
 order by nome;
