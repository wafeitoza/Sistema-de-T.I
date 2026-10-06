-- =============================================================================
-- Fase A — Esquema inicial do IT Stock
-- Espelha as coleções do localStorage (src/types/index.ts) 1:1, em snake_case.
-- Convenções:
--   * ids de negócio são text no mesmo formato do app (MAN-2026-000001, SET-...)
--   * datas de negócio (DD/MM/AAAA no app) => coluna date (AAAA-MM-DD)
--   * carimbos ISO (criadoEm/atualizadoEm/dataHora) => timestamptz
--   * todo registro editável tem atualizado_em para detecção de conflito (Fase B)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- usuarios — origem do login (Fase C liga auth_id ao Supabase Auth)
-- -----------------------------------------------------------------------------
create table public.usuarios (
  email         text primary key,
  nome          text not null check (btrim(nome) <> ''),
  perfil        text not null check (perfil in ('Admin', 'Gerente', 'Técnico', 'Visualizador')),
  setor         text not null default '',
  status        text not null default 'Ativo' check (status in ('Ativo', 'Inativo')),
  telefone      text,
  foto          text,          -- data URL base64 256x256 (Fase B: considerar Storage)
  auth_id       uuid unique,   -- Fase C: alter table add constraint fk → auth.users(id)
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index usuarios_perfil_idx on public.usuarios (perfil);
create index usuarios_setor_idx on public.usuarios (setor);

-- -----------------------------------------------------------------------------
-- setores — nome é a chave de referência usada em ativos/movimentações
-- -----------------------------------------------------------------------------
create table public.setores (
  id            text primary key,
  nome          text not null check (btrim(nome) <> ''),
  responsavel   text not null default '',
  localizacao   text not null default '',
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- unicidade como o app valida: comparação sem distinção de maiúsculas
create unique index setores_nome_unico_idx on public.setores (lower(btrim(nome)));

-- -----------------------------------------------------------------------------
-- fornecedores
-- -----------------------------------------------------------------------------
create table public.fornecedores (
  id            text primary key,
  nome          text not null check (btrim(nome) <> ''),
  cnpj          text not null default '',
  email         text,
  telefone      text,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index fornecedores_nome_unico_idx on public.fornecedores (lower(btrim(nome)));

-- -----------------------------------------------------------------------------
-- ativos — RN001: código único (PK) — descarte/estados via CHECK (RN002)
-- -----------------------------------------------------------------------------
create table public.ativos (
  codigo              text primary key
                    check (codigo ~ '^[A-Z]{2,4}-[0-9]{3,}$'),  -- NOTE-001, CPU-1000 (RN001)
  descricao           text not null check (btrim(descricao) <> ''),
  tipo                text not null,
  marca               text,
  modelo              text,
  serial              text,
  tombamento          text,
  setor               text not null,
  responsavel         text not null,
  status              text not null default 'Ativo'
                    check (status in ('Ativo', 'Inativo', 'Manutenção', 'Descartado')),
  data_aquisicao      date not null,
  valor_aquisicao     numeric(12, 2) check (valor_aquisicao is null or valor_aquisicao >= 0),
  localizacao         text,
  qr_url              text not null,
  ultima_manutencao   date,
  proxima_manutencao  date,
  notas               text,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);

create index ativos_status_idx on public.ativos (status);
create index ativos_setor_idx on public.ativos (setor);
create index ativos_responsavel_idx on public.ativos (responsavel);
create index ativos_proxima_manutencao_idx on public.ativos (proxima_manutencao);

-- -----------------------------------------------------------------------------
-- estoque — código gerado pelo app no padrão Item-001 (RN003 é derivado)
-- -----------------------------------------------------------------------------
create table public.estoque (
  codigo              text primary key,
  descricao           text not null check (btrim(descricao) <> ''),
  categoria           text not null,
  quantidade          integer not null default 0 check (quantidade >= 0),
  quantidade_minima   integer not null default 0 check (quantidade_minima >= 0),
  unidade             text not null,
  fornecedor          text,
  preco_unitario      numeric(10, 2) check (preco_unitario is null or preco_unitario >= 0),
  notas               text,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);

create index estoque_categoria_idx on public.estoque (categoria);
create index estoque_fornecedor_idx on public.estoque (fornecedor);

-- -----------------------------------------------------------------------------
-- entradas_estoque / saidas_estoque — eventos imutáveis do estoque
-- -----------------------------------------------------------------------------
create table public.entradas_estoque (
  id              text primary key,
  data            date not null,
  codigo_item     text not null references public.estoque (codigo),
  quantidade      integer not null check (quantidade > 0),
  preco_unitario  numeric(10, 2) check (preco_unitario is null or preco_unitario >= 0),
  fornecedor      text,
  tipo            text not null check (tipo in ('Compra', 'Devolução', 'Ajuste', 'Doação')),
  nf              text,
  usuario         text not null,
  notas           text,
  criado_em       timestamptz not null default now()
);

create index entradas_estoque_item_idx on public.entradas_estoque (codigo_item);
create index entradas_estoque_data_idx on public.entradas_estoque (data);

create table public.saidas_estoque (
  id              text primary key,
  data            date not null,
  codigo_item     text not null references public.estoque (codigo),
  quantidade      integer not null check (quantidade > 0),
  tipo            text not null check (tipo in ('Fornecimento', 'Destruição', 'Empréstimo', 'Devolução', 'Ajuste')),
  responsavel     text not null,
  motivo          text,
  usuario         text not null,
  observacoes     text,
  criado_em       timestamptz not null default now()
);

create index saidas_estoque_item_idx on public.saidas_estoque (codigo_item);
create index saidas_estoque_data_idx on public.saidas_estoque (data);

-- -----------------------------------------------------------------------------
-- solicitacoes — RN004: aprovacao_token (Fase D) substitui o HMAC client-side
-- -----------------------------------------------------------------------------
create table public.solicitacoes (
  id                text primary key,
  data              date not null,
  solicitante       text not null,
  tipo              text not null
                  check (tipo in ('Novo Ativo', 'Substituição', 'Reparo', 'Consumível', 'Manutenção', 'Outro')),
  descricao         text not null check (btrim(descricao) <> ''),
  prioridade        text not null default 'Normal' check (prioridade in ('Alta', 'Normal', 'Baixa')),
  status            text not null default 'Rascunho'
                  check (status in ('Rascunho', 'Enviada', 'Aprovada', 'Rejeitada', 'Finalizada')),
  aprovador         text not null,
  token             text,            -- HMAC atual (removido na Fase D)
  token_expira_em   timestamptz,
  aprovacao_token   uuid unique,      -- Fase D: UUID aleatório no banco (sem segredo no bundle)
  data_aprovacao    date,
  motivo_rejeicao   text,
  data_finalizacao  date,
  notas_internas    text,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);

create index solicitacoes_status_idx on public.solicitacoes (status);
create index solicitacoes_solicitante_idx on public.solicitacoes (solicitante);
create index solicitacoes_aprovador_idx on public.solicitacoes (aprovador);

-- -----------------------------------------------------------------------------
-- manutencoes — RN007: próxima preventiva = conclusão + 90 dias (calculada no app)
-- -----------------------------------------------------------------------------
create table public.manutencoes (
  id              text primary key,
  codigo_ativo    text not null references public.ativos (codigo),
  tipo            text not null check (tipo in ('Preventiva', 'Corretiva', 'Inspeção')),
  data_agendada   date not null,
  data_realizada  date,
  tecnico         text not null,
  status          text not null default 'Agendada'
                check (status in ('Agendada', 'Em Execução', 'Concluída', 'Cancelada')),
  descricao       text not null check (btrim(descricao) <> ''),
  resultado       text,
  proxima_data    date,
  custo           numeric(10, 2) check (custo is null or custo >= 0),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);

create index manutencoes_ativo_idx on public.manutencoes (codigo_ativo);
create index manutencoes_status_idx on public.manutencoes (status);
create index manutencoes_agendada_idx on public.manutencoes (data_agendada);

-- -----------------------------------------------------------------------------
-- contagens + contagem_itens (itens embutidos no objeto Contagem do app)
-- -----------------------------------------------------------------------------
create table public.contagens (
  id                text primary key,
  nome              text not null check (btrim(nome) <> ''),
  data              date not null,
  status            text not null default 'Em andamento'
                  check (status in ('Em andamento', 'Concluída')),
  responsavel       text not null,
  concluida_em      timestamptz,
  ajustes_gerados   integer not null default 0 check (ajustes_gerados >= 0),
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);

create index contagens_status_idx on public.contagens (status);

create table public.contagem_itens (
  contagem_id   text not null references public.contagens (id) on delete cascade,
  codigo_item   text not null references public.estoque (codigo),
  contado       integer check (contado is null or contado >= 0),
  contado_em    timestamptz,
  primary key (contagem_id, codigo_item)
);

create index contagem_itens_item_idx on public.contagem_itens (codigo_item);

-- -----------------------------------------------------------------------------
-- termos — RN005: hash SHA-256 do conteúdo
-- -----------------------------------------------------------------------------
create table public.termos (
  id            text primary key,
  ativo_codigo  text not null references public.ativos (codigo),
  responsavel   text not null,
  conteudo      text not null check (btrim(conteudo) <> ''),
  hash          text not null,
  status        text not null default 'Pendente' check (status in ('Pendente', 'Assinado', 'Revogado')),
  criado_em     timestamptz not null default now(),
  criado_por    text not null,
  atualizado_em timestamptz not null default now(),
  assinado_em   timestamptz,
  assinado_por  text,
  revogado_em   timestamptz,
  revogado_por  text
);

create index termos_ativo_idx on public.termos (ativo_codigo);
create index termos_status_idx on public.termos (status);

-- -----------------------------------------------------------------------------
-- movimentacoes — RN006 (a troca de setor do ativo é coordenada pelo app)
-- -----------------------------------------------------------------------------
create table public.movimentacoes (
  id                   text primary key,
  codigo_ativo         text not null references public.ativos (codigo),
  setor_origem         text not null,
  setor_destino        text not null,
  responsavel_destino  text not null,
  status               text not null default 'Pendente'
                     check (status in ('Pendente', 'Confirmada', 'Cancelada')),
  criado_em            timestamptz not null default now(),
  criado_por           text not null,
  confirmado_em        timestamptz,
  confirmado_por       text,
  cancelado_em         timestamptz,
  cancelado_por        text,
  constraint movimentacoes_rn006_setores_diferentes
    check (setor_origem <> setor_destino)
);

create index movimentacoes_ativo_idx on public.movimentacoes (codigo_ativo);
create index movimentacoes_status_idx on public.movimentacoes (status);

-- -----------------------------------------------------------------------------
-- auditoria — append-only (triggers na migration seguinte); RN009
-- -----------------------------------------------------------------------------
create table public.auditoria (
  id           text primary key,
  data_hora    timestamptz not null default now(),
  usuario      text not null,
  acao         text not null
             check (acao in ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'IMPORT', 'EXPORT', 'RESET')),
  tabela       text not null,
  registro_id  text not null,
  campos       jsonb not null default '[]'::jsonb,
  resultado    text not null default 'Sucesso' check (resultado in ('Sucesso', 'Erro')),
  mensagem     text
);

create index auditoria_data_hora_idx on public.auditoria (data_hora desc);
create index auditoria_usuario_idx on public.auditoria (usuario);
create index auditoria_tabela_idx on public.auditoria (tabela);
create index auditoria_acao_idx on public.auditoria (acao);

-- -----------------------------------------------------------------------------
-- sequencias — substitui as chaves ITSTOCK_SEQ_* do localStorage
-- -----------------------------------------------------------------------------
create table public.sequencias (
  nome        text primary key,
  valor       integer not null default 0 check (valor >= 0),
  atualizado_em timestamptz not null default now()
);
