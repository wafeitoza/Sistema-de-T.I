-- =============================================================================
-- Empréstimos de equipamentos para uso pessoal
-- Ciclo de vida: 'Em aberto' → 'Devolvido' (ou 'Cancelado' para corrigir
-- lançamento incorreto). O empréstimo é um registro à parte: ele NÃO altera
-- status/setor/responsável do ativo emprestado.
-- =============================================================================

create table public.emprestimos (
  id                   text primary key,
  codigo_ativo         text not null references public.ativos (codigo),
  funcionario          text not null check (btrim(funcionario) <> '' and char_length(btrim(funcionario)) >= 3),
  matricula            text,
  setor                text not null check (btrim(setor) <> ''),
  data_emprestimo      date not null,
  previsao_devolucao   date not null,
  data_devolucao       date,
  observacao_emprestimo text,
  observacao_devolucao  text,
  status               text not null default 'Em aberto'
                     check (status in ('Em aberto', 'Devolvido', 'Cancelado')),
  registrado_por       text not null,
  devolvido_por        text,
  cancelado_por        text,
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now(),
  constraint emprestimos_prazo_valido
    check (previsao_devolucao >= data_emprestimo),
  -- devolução/cancelamento só fazem sentido com a data correspondente preenchida
  constraint emprestimos_devolucao_preenchida
    check (status <> 'Devolvido' or data_devolucao is not null)
);

create index emprestimos_ativo_idx on public.emprestimos (codigo_ativo);
create index emprestimos_status_idx on public.emprestimos (status);
create index emprestimos_funcionario_idx on public.emprestimos (funcionario);

-- Só pode haver um empréstimo em aberto por equipamento (a regra também é
-- aplicada na store; aqui vale como garantia de integridade no banco).
create unique index emprestimos_ativo_em_aberto_uniq
  on public.emprestimos (codigo_ativo)
  where status = 'Em aberto';

-- carimbo automático (a lista da migration de auditoria é fixa; declaramos aqui)
create trigger emprestimos_marca_atualizado
  before update on public.emprestimos
  for each row execute function public.marcar_atualizado_em();

-- sequência EMP — mesmo contrato da proxima_sequencia() do app
insert into public.sequencias (nome, valor) values ('EMP', 0)
on conflict (nome) do nothing;

-- RLS ligado junto com a tabela (nunca tabela exposta sem policy).
grant select, insert, update, delete on public.emprestimos to anon, authenticated, service_role;
alter table public.emprestimos enable row level security;
-- TEMPORÁRIO (Fase B/D) — espelho do acesso geral das demais tabelas
create policy emprestimos_acesso_geral_temporario on public.emprestimos
  for all to anon, authenticated, service_role
  using (true) with check (true);
