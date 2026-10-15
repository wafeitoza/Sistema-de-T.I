-- =============================================================================
-- Credenciais de integração (refresh token do Gmail)
--
-- Tabela deliberadamente estreita e sem leitura para ninguém além das
-- Functions. O refresh token do Gmail equivale a acesso TOTAL à caixa de
-- entrada de quem conectou — ler, marcar como lido, responder, apagar. Por
-- isso três camadas:
--   1. sem grant para anon nem authenticated e sem policy de select;
--   2. o valor é guardado CIFRADO (AES-256-GCM, chave em env var) — um dump
--      do banco ou um backup vazado não viram acesso ao e-mail;
--   3. o navegador nunca recebe o token: as Functions leem direto do banco.
--
-- A tabela NÃO entra em `DEFINICOES` (`src/data/api.ts`), então o espelho do
-- localStorage não a copia e o `carregarTudo()` não a busca — não há caminho
-- pelo qual o bundle do navegador a enxergue.
-- =============================================================================

create table public.integracoes (
  id                   text primary key,
  conta                text not null check (btrim(conta) <> ''),
  segredo_cifrado      text not null,
  escopos              text,
  -- Consulta do Gmail que define o que vira chamado. Sem filtro explícito a
  -- sincronização importaria TODO o e-mail da caixa — inclusive newsletters e
  -- cobranças — como se fosse chamado de TI. O valor é editável na tela.
  filtro               text not null default 'in:inbox newer_than:7d',
  ultima_sincronizacao timestamptz,
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now()
);

create trigger integracoes_marca_atualizado
  before update on public.integracoes
  for each row execute function public.marcar_atualizado_em();

-- só o papel de serviço (as Functions em api/) alcança esta tabela
grant select, insert, update, delete on public.integracoes to service_role;

alter table public.integracoes enable row level security;
create policy integracoes_service_role on public.integracoes
  for all to service_role using (true) with check (true);

revoke all on table public.integracoes from anon, authenticated;
