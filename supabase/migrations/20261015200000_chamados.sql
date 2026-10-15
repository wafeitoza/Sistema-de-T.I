-- =============================================================================
-- Chamados (helpdesk) integrados ao Gmail
--
-- Ciclo de vida: 'Aberto' → 'Em atendimento' → 'Resolvido' (ou 'Cancelado'
-- para corrigir lançamento incorreto). 'Aguardando usuário' existe porque a
-- maioria dos chamados de TI trava esperando retorno de quem abriu, e num
-- sistema só de três estados esse tempo aparece como "em atendimento" e
-- distorce a métrica de quanto a TI demora.
--
-- Duas tabelas de propósito:
--   chamados          = o pedido em si (estado, prioridade, responsável)
--   chamado_mensagens = o fio do e-mail, mensagem a mensagem
-- O fio fica à parte porque um chamado recebe N e-mails ao longo do tempo e
-- apagar/reescrever o cabeçalho a cada resposta destruiria o histórico.
--
-- A integração com o Gmail preenche `email_thread_id`/`email_mensagem_id`. Os
-- índices únicos parciais que cobrem essas colunas são o que impede que uma
-- nova sincronização reapresente o mesmo e-mail como chamado novo — a dedupe
-- vale mesmo se o cliente falhar no meio da importação.
-- =============================================================================

create table public.chamados (
  id                text primary key,
  assunto           text not null check (btrim(assunto) <> ''),
  descricao         text,
  solicitante       text not null check (btrim(solicitante) <> ''),
  origem            text not null default 'Manual'
                    check (origem in ('Manual', 'E-mail')),
  prioridade        text not null default 'Média'
                    check (prioridade in ('Baixa', 'Média', 'Alta', 'Crítica')),
  status            text not null default 'Aberto'
                    check (status in ('Aberto', 'Em atendimento', 'Aguardando usuário', 'Resolvido', 'Cancelado')),
  atribuido_a       text references public.usuarios (email),
  email_thread_id   text,
  email_mensagem_id text,
  email_url         text,
  resolvido_em      timestamptz,
  registrado_por    text not null,
  resolvido_por     text,
  cancelado_por     text,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now(),
  -- 'Em atendimento' sem responsável não diz nada a quem abre o chamado
  constraint chamados_atendimento_com_responsavel
    check (status <> 'Em atendimento' or atribuido_a is not null),
  -- resolvido/cancelado só com o carimbo correspondente
  constraint chamados_fechamento_com_responsavel
    check ((status <> 'Resolvido' or resolvido_por is not null)
       and (status <> 'Cancelado' or cancelado_por is not null))
);

create index chamados_status_idx on public.chamados (status);
create index chamados_solicitante_idx on public.chamados (solicitante);
create index chamados_atribuido_idx on public.chamados (atribuido_a);
create index chamados_criado_idx on public.chamados (criado_em desc);
create index chamados_thread_idx on public.chamados (email_thread_id);

-- Um e-mail do Gmail vira no máximo um chamado. Parcial porque chamado manual
-- não tem mensagem de origem (null não disputa a unicidade).
create unique index chamados_email_mensagem_uniq
  on public.chamados (email_mensagem_id)
  where email_mensagem_id is not null;

create trigger chamados_marca_atualizado
  before update on public.chamados
  for each row execute function public.marcar_atualizado_em();

insert into public.sequencias (nome, valor) values ('CHM', 0)
on conflict (nome) do nothing;

-- -----------------------------------------------------------------------------
-- Fio do e-mail
-- -----------------------------------------------------------------------------
create table public.chamado_mensagens (
  id             text primary key,
  chamado_id     text not null references public.chamados (id) on delete cascade,
  direcao        text not null check (direcao in ('recebida', 'enviada')),
  remetente      text not null check (btrim(remetente) <> ''),
  destinatarios  text,
  assunto        text,
  corpo          text,
  email_id       text,
  recebido_em    timestamptz not null default now(),
  criado_em      timestamptz not null default now()
);

create index chamado_mensagens_chamado_idx on public.chamado_mensagens (chamado_id);
create index chamado_mensagens_recebido_idx on public.chamado_mensagens (recebido_em desc);

-- mesma garantia de dedupe, no nível da mensagem
create unique index chamado_mensagens_email_uniq
  on public.chamado_mensagens (email_id)
  where email_id is not null;

insert into public.sequencias (nome, valor) values ('CMM', 0)
on conflict (nome) do nothing;

-- -----------------------------------------------------------------------------
-- RLS — sem policy temporária: as policies definitivas já existem neste
-- commit. Tabela nova exposta sem policy abriria leitura para todo mundo.
-- -----------------------------------------------------------------------------
grant select, insert, update, delete on public.chamados, public.chamado_mensagens
  to authenticated, service_role;

alter table public.chamados enable row level security;
alter table public.chamado_mensagens enable row level security;

-- leitura: qualquer autenticado (mesmo contrato das demais tabelas de negócio)
create policy chamados_leitura on public.chamados
  for select to authenticated using (true);

create policy chamado_mensagens_leitura on public.chamado_mensagens
  for select to authenticated using (true);

-- escrita: quem opera o sistema. Visualizador vê a fila, não mexe nela.
create policy chamados_escrita on public.chamados
  for all to authenticated
  using (public.pode_editar()) with check (public.pode_editar());

create policy chamado_mensagens_escrita on public.chamado_mensagens
  for all to authenticated
  using (public.pode_editar()) with check (public.pode_editar());

-- service_role: a sincronização do Gmail escreve pelo servidor e precisa
-- enxergar o histórico para não reimportar o que já entrou.
create policy chamados_service_role on public.chamados
  for all to service_role using (true) with check (true);

create policy chamado_mensagens_service_role on public.chamado_mensagens
  for all to service_role using (true) with check (true);

-- anon não enxerga nada (defesa em profundidade, mesmo das demais tabelas)
revoke all on table public.chamados, public.chamado_mensagens from anon;
