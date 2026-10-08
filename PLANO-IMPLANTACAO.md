# PLANO DE IMPLANTAÇÃO E PONTO DE RETOMADA

> Documento de continuidade — **última atualização: 07/10/2026 (Fase A + B + C + D — segurança server-side)**
> Leia este arquivo para continuar de onde paramos.

---

## 1. Estado atual do projeto

**Repo:** `https://github.com/wafeitoza/Sistema-de-T.I.git` (branch `main`)
**Produção:** https://it-stock-react.vercel.app (build `index-CkBHuD9P.js` = Fase D, modo localStorage)
**Diretório:** `/home/williamfeitoza/IT-Stock-Global/Projects/it-stock-react/`

### Commits (rodada de melhorias concluída)

| Fase | Commit | Conteúdo |
|---|---|---|
| 1 | `020e41e` | Auditoria (filtros, diff, CSV) + Configurações (tema, stats, backup) |
| 2 | `fde176f` | Sino de notificações, busca global Ctrl+K, ordenação/paginação em tabelas |
| 3 | `bc65fdc` | Relatórios (6 gráficos, filtros, CSV, impressão) |
| 4 | `d82a2ca` | Termos com SHA-256 + etiquetas QR para impressão |
| 5 | `7fdda6e` | Setores, fornecedores, movimentações (RN006), sidebar em seções |
| 6 | `972ad00` | Vitest (55 testes), lint 0 warnings, dead code, README, badge "Em andamento" |
| — | `8474564` | Recorte de foto (zoom + arrastar) no modal de usuários |
| A | `9fa928e` | Migrations SQL do Supabase em `supabase/migrations/` (15 tabelas, RLS, auditoria append-only) |
| — | `4fdf939` | Exclusão de fornecedores com bloqueio por vínculo + auditoria DELETE |
| — | `367f004` | Nova aba **Empréstimos** (controle de equipamentos emprestados a funcionários) |
| — | `de1d1e3` | **Etiquetas e QR com todos os dados do equipamento** + campo `configuracao` |
| B | `18b5968` | **Fase B** — camada de dados dual (Supabase + localStorage), blocos de 50 IDs |
| C | `fdebae4` | **Fase C** — login e-mail+senha, contas por Admin, sessão persistida |
| — | `e2bb9c1` | Correção da vulnerabilidade npm (`source-map-js`) → 0 vulnerabilities |
| — | `5a915ac` | "Empréstimos" → **"Empréstimos de Equipamentos"** (menu, rotas, títulos internos) |
| — | `c31ee83` | Fonte principal **Inter** (JetBrains Mono continua no monoespaçado) |
| D | *(Fase D — ver seção 3)* | RLS por perfil, aprovação por UUID no banco, `anon` sem tabelas, auditoria assinada, restore validado |

### Qualidade (validado na última entrega — 07/10/2026)
- `npm run lint` → **0 warnings, 0 erros**
- `npx tsc -b` → OK (`tsc --noEmit` na raiz não checa `tsconfig.app.json` — **use `tsc -b`**)
- `npm test` → **141/141** (Vitest + happy-dom, 16 arquivos)
- `npm run build` → OK (`tsc -b` incluído)
- **RLS em Postgres 17 real (Docker)**: `supabase/tests/rls_fase_d.sql` → **81 checagens, 0 falhas**
- E2E Chrome headless: local e produção com **0 erros de console**
  (últimas rodadas: `cdp-etiquetas.mjs` 21 checks · `cdp-persistencia.mjs` 15 checks · **`cdp-login.mjs` 21 checks (Fase C, local)** · **`cdp-fase-d.mjs` 13 checks (Fase D, local)** — login por card, card de atividade só p/ Admin, link de aprovação gerado com UUID, página `/aprovacao/<uuid>`, token inválido, logout e dashboard do Visualizador)

### Estado do Git
`main` sincronizada com `origin/main`, topo = **Fase D** (RLS + aprovação por token).
Produção no build `index-CkBHuD9P.js` (código da Fase D no ar — confirmado que o bundle **não** tem mais
o segredo `IT-STOCK-MVP-2026`), porém **ainda em modo localStorage** porque as env vars da Vercel não
foram criadas. As 2 migrations da Fase D **foram aplicadas no banco de produção em 07/10/2026** e
conferidas objeto a objeto (47 policies, 0 temporárias, `anon` sem privilégio de tabela, 12 funções,
2 RPCs do link executáveis por `anon`); o histórico `supabase_migrations.schema_migrations` foi
baselado pela CLI e `supabase db push` responde *Remote database is up to date*. Falta só a etapa 2 do
deploy: env vars da Vercel + Redeploy.

### Funcionalidade nova (06/10/2026) — aba **Empréstimos**
Controle de empréstimo de equipamento de informática para **uso pessoal**, em `/emprestimos` (seção Operação, perfis Admin/Gerente/Técnico).

- **Modelo**: `Emprestimo` (`src/types/index.ts`) — `id EMP-2026-NNNNNN`, `codigoAtivo` (FK lógica p/ `Ativo.codigo`), funcionário/matrícula/setor em **texto livre**, `dataEmprestimo`/`previsaoDevolucao`/`dataDevolucao` em `DD/MM/AAAA`, `status: 'Em aberto' | 'Devolvido' | 'Cancelado'`.
- **Regras** (`src/store/emprestimos.ts`): não empresta ativo `Descartado` nem item já com empréstimo **Em aberto** (mensagem diz para quem); nome ≥ 3 letras; setor obrigatório; `previsao >= data`; devolução grava `dataDevolucao = hoje` + `devolvidoPor`; **cancelar** só Admin/Gerente (correção de lançamento). Tudo com log de auditoria `tabela = EMPRESTIMOS`.
- **O empréstimo NÃO altera o Ativo** (decisão do usuário): status/setor/responsável ficam como estão.
- **UI** (`src/pages/emprestimos/`): cards de Resumo (Em aberto / **Atrasados** / Devolvidos / Total), chips de filtro incluindo *Atrasado*, busca, tabela com prazo ("em N dia(s)" / "atrasada"), badge `Atrasado`, modais de novo empréstimo, devolução (observação do estado) e cancelamento.
- **Alertas**: `src/lib/notificacoes.ts` ganhou `dados.emprestimos` → "Empréstimo atrasado" (danger) e "Devolução próxima" (warning), só para perfis com acesso à rota.
- **Seed**: 3 empréstimos (1 em aberto, 1 atrasado, 1 devolvido) + `ITSTOCK_SEQ_EMP`.
- **Backup**: `EMPRESTIMOS` em `COLECOES_BACKUP`, `EMP` em `SEQUENCIAS_BACKUP`.
- **Testes**: `src/store/emprestimos.test.ts` (8 casos) — 67/67 no total.
- **E2E**: `/tmp/opencode/cdp-emprestimos.mjs` — 34 checks (menu, cards, filtros, criação, bloqueio, devolução, cancelamento, auditoria, 0 erros de console).

### Funcionalidade nova (06/10/2026) — **Etiquetas e QR com dados do equipamento**
Etiqueta em `/ativos` (botão **Etiquetas**) agora identifica o equipamento completo: **setor, tombamento, configuração, marca, modelo e responsável** — os mesmos dados vão dentro do QR, então escaneando no celular lê-se tudo sem o sistema.

- **Campo `configuracao`** (opcional) em `Ativo` + `NovoAtivo` + form de ativo (`AtivoFormModal`) — ex.: `i7 13ª / 16GB / SSD 512GB`. Migration `20261006020000_ativos_configuracao.sql` (`alter table ... add column if not exists`); seed preenche NOTE-001/NOTE-002/MON-001/CPU-001.
- **`conteudoQRAtivo()`** em `src/lib/codes.ts`: monta o texto multi-linha da etiqueta (`codigo`, `descricao`, `Tomb:`, `Setor:`, `Config:`, `Marca:`, `Modelo:`, `Resp.:`), omitindo campos vazios. `urlQRCode()` continua igual (quickchart.io) e recebe esse conteúdo.
- **QR recalculado no render** em `EtiquetasModal` e no modal de QR de `AtivosPage` (hoje editou o ativo → etiqueta/QR já saem atualizados). `qrUrl` persistido também é regravado em `criar()`/`atualizar()` do store e no `aplicarSeed()` (já com tombamento sorteado).
- **UI**: etiqueta ganhou as linhas `Setor`/`Config`/`Marca · Modelo`/`Resp.` (`text-[10px] truncate`), lista de seleção mostra tombamento · setor · configuração, e o modal de QR individual lista os mesmos dados. Layout e `@media print` intactos (decisão do usuário: só adicionar campos).
- **Testes**: novos casos em `src/lib/codes.test.ts` + arquivo `src/store/ativos.test.ts` (2 casos: `criar`/`atualizar` regravam `qrUrl`).
- **E2E**: `/tmp/opencode/cdp-etiquetas.mjs` — 21 checks (campo no form, persistência, dados no QR, etiqueta com os 6 campos, recalculo após edição, CSS de impressão, 0 erros de console).

### Funcionalidade nova (06/10/2026) — **Fase C: login e sessão reais**
E-mail + senha no Supabase Auth; o login por card continua só no modo local (sem env vars).

- **`src/data/auth.ts`** — `entrarComSenha` (mensagens de erro traduzidas), `sessaoAtual`, `trocarSenhaSupabase` (troca a senha **e** desliga `user_metadata.trocar_senha`), `sairDoSupabase`, `tokenAtual`, `mensagemAuth`.
- **`src/store/auth.ts`** — `entrarComSenha`, `restaurarSessao`, `trocarSenha` + flag `trocarSenhaPendente`; o perfil vem do espelho `USUARIOS` (conta Auth sem perfil ativo → desloga e avisa).
- **`LoginPage`** — no modo Supabase renderiza formulário (e-mail + senha + olho de mostrar/ocultar) e **esconde os cards**; erros exibidos em `[role=alert]`.
- **`Layout`** — modal `TrocaSenhaObrigatoria` (não fechável) enquanto `trocarSenhaPendente`; mínimo 8 caracteres e confirmação.
- **`main.tsx`** — `restaurarSessao()` roda **antes** de montar o `App`, senão o Layout redirecionaria pro login a cada F5.
- **Contas (`src/data/admin.ts` → `api/usuarios.mjs`)**: criar/redefinir só pela Vercel Function (service_role nunca vai pro bundle). O navegador manda o próprio `access_token`; a função valida o chamador em `/auth/v1/user` + `usuarios` (perfil Admin e Ativo) antes de tocar no Supabase. Criar = Auth + linha em `usuarios` (com rollback da conta se o perfil falhar); `auth_id` nunca é escrito pelo navegador (`paraBanco` ignora `authId`).
- **`UsuariosPage`** — botão **Nova senha** por linha (só Ativo) e criação de usuário chama a API; a senha provisória aparece **uma única vez** em modal com botão copiar.
- **Riscos adiados da Fase B resolvidos:** `keepalive` no `client.ts` (F5 em até 60 KB não perde a escrita). *IDs de ATIVOS/itens de estoque continuam no cliente — ainda pendente.*
- **Bug achado no caminho:** o GoTrue só aceita **`PUT`** em `/auth/v1/admin/users/{id}` — `PATCH` devolve **405**. Afetava `redefinir` da Function e o script de senhas; corrigido nos dois.
- **`scripts/gerar-senhas.mjs`** — zera as senhas dos usuários (provisória + `trocar_senha=true`) lendo `SUPABASE_SERVICE_ROLE_KEY` do ambiente/`.env.local` (gitignored). Uso: `node scripts/gerar-senhas.mjs [email]`.
- **Testes:** `auth.test.ts` (21) + `admin.test.ts` (8) + `store/auth.test.ts` (11) → **132/132**.
- **E2E** `/tmp/opencode/cdp-login.mjs` — **21 checks, 0 falhas**: card escondido · senha errada → erro amigável · olho da senha · provisória → modal de troca bloqueante · troca → toast · F5 mantém sessão · logout · senha nova sem pedir troca · 0 erros de console (o único 4xx é o `400` esperado do login errado).

### Funcionalidade nova (07/10/2026) — **Fase D: segurança server-side**
Nada de visual mudou; o que mudou é o que o servidor aceita fazer.

**Migrations novas (aplicadas no banco de produção em 07/10/2026):**
- `20261007010000_rls_por_perfil.sql` — helpers (`perfil_atual`, `perfil_em`, `e_admin`, `pode_gerenciar`, `pode_editar`, `papel_requisicao`, `uid_requisicao`, `email_do_usuario`), **`revoke … from anon` em todas as tabelas**, policies por perfil (leitura = autenticado, exceto `auditoria` → Admin/Gerente; escrita = Admin/Gerente/Técnico em `pode_editar`, `setores`/`fornecedores`/`solicitacoes` → Admin/Gerente, `usuarios` → só Admin), `service_role` coberto por policy explícita, triggers `usuarios_protegidos` (bloqueia auto-promoção e muda `auth_id` só via papel `service_role`) e `auditoria_assinada`, e `execute` de `proxima_sequencia`/`reservar_sequencia` revogado do `anon`.
- `20261007020000_aprovacao_por_token.sql` — RPCs `solicitacao_por_token(uuid)` e `decidir_por_token(uuid,text,text)` (SECURITY DEFINER, executáveis por `anon`) para a página pública de aprovação.
- `20261008010000_anon_sem_helpers.sql` + `20261008020000_anon_sem_helpers_supabase.sql` — **hardening**: `create or replace function` concede `execute` a `PUBLIC` (e, no Supabase, o `pg_default_acl` de `supabase_admin` concede **direto** a `anon` em `pg_proc.proacl`). Fora da regra da Fase D, o `anon` conseguia chamar `perfil_atual()`, `e_admin()` etc. pelo PostgREST — devolviam `null`/`false` (sem vazamento), mas só as 2 RPCs do link podem ser visíveis a ele. As duas migrations revogam de `public` **e** de `anon` e reafirmam o grant para `authenticated`/`service_role` (sem o grant as policies parariam de funcionar e **toda escrita seria negada**). **Gotcha que vale para o resto do projeto: em Supabase toda função nova nasce executável por `anon` — toda RPC precisa de revoke explícito.**

**No app:**
- `src/lib/token.ts` — token agora é `crypto.randomUUID()` gravado em `solicitacoes.aprovacao_token` (+ `token_expira_em`); **nenhum segredo no bundle**. A coluna antiga `token` (HMAC) ficou deprecada de propósito, para não quebrar um link já enviado durante o deploy.
- `src/data/aprovacao.ts` (novo) — consultas/decisões por RPC, sem ler tabela.
- `src/pages/solicitacoes/AprovacaoPage.tsx` — usa as RPCs no modo Supabase; no modo local continua lendo o espelho. Expiração conferida no mount (render puro).
- `src/data/bootstrap.ts` — **não baixa nada sem sessão**; `baixarDados()` roda após o 1º login e chama `recarregarTodasAsLojas()` (`src/store/recarregar.ts`, novo). Resultado: sem sessão o app sobe instantâneo e sem toast de erro.
- `src/pages/DashboardPage.tsx` — card "Atividade recente" só aparece para quem acessa `/auditoria`.
- `src/lib/backup.ts` — `validarBackup` valida **formato de cada registro e chave primária**; `aplicarBackup` devolve `{ ignoradas }` e **pula `USUARIOS` no modo Supabase** (contas são do servidor).

**Como validar (tudo já rodou aqui):**
```bash
npm run lint && npx tsc -b && npm test && npm run build   # 0 warnings, 141/141
# RLS em Postgres 17 (receita no topo de supabase/tests/rls_fase_d.sql) — 81/81
docker exec -i pg-rls psql -U postgres -d itstock -v ON_ERROR_STOP=1 < supabase/tests/rls_fase_d.sql
```
**RLS do exterior (rodado em 08/10/2026, só com a chave pública)**: `anon` → 401 em `/ativos` e `/auditoria`,
401 nas 6 helpers e em `proxima_sequencia`, OpenAPI sem nenhuma tabela exposta, `INSERT` negado — e
`200` em `solicitacao_por_token` (o link público continua funcionando) · `service_role` → `200` em
`/usuarios`. **8 checks, 0 falhas** (script em `/tmp/opencode/testa-rls-externo.sh`).

**Ordem de deploy (importa):** 1) ✅ aplicar as 2 migrations (feito em 07/10/2026) → 2) criar as env vars da Vercel e Redeploy → 3) só então considerar produção.

**CLI do Supabase (07/10/2026):** `npm i -g supabase` → `supabase login` → `supabase init` (cria `supabase/config.toml` + `supabase/.gitignore`, ambos versionados) → `supabase link --project-ref ftwaxhngujwswaauqfbn`. Como as 8 primeiras migrations entraram pelo SQL Editor, o histórico remoto estava vazio e o `db push` queria reaplicar as 10 — feito *baseline* com `supabase migration repair <versão> --status applied` (8×) e depois as 2 novas entraram via `db push`. Tudo pela Management API, **sem precisar da senha do banco**. Próximas migrations: `supabase db push --dry-run` → `supabase db push`.

### Pendências / cuidados
- ✅ **2 migrations da Fase D aplicadas no Supabase** (07/10/2026) e verificadas no banco real: 47 policies (16 `_leitura` / 14 `_escrita` / 16 `_service_role` / `auditoria_insere`), **0** policies `*_temporario`, `anon` com **0** privilégios de tabela e **0** policies, `proxima_sequencia`/`reservar_sequencia` **sem** `execute` para `anon` (e sem `PUBLIC`), e as 2 RPCs do link **com** `execute` para `anon`.
- ⚠️ **Revogar o token da Vercel** (`vcp_8aAoy...`) usado nos deploys — trabalho da rodada terminou.
- ⚠️ **Criar as env vars na Vercel** (Settings → Environment Variables): `VITE_SUPABASE_URL` = `https://ftwaxhngujwswaauqfbn.supabase.co` · `VITE_SUPABASE_PUBLISHABLE_KEY` = `sb_publishable_DPdZU8GA-…` · `SUPABASE_URL` (mesma URL) · `SUPABASE_PUBLISHABLE_KEY` (mesma chave) · `SUPABASE_SERVICE_ROLE_KEY` = `sb_secret_…` (as 3 últimas **sem** prefixo `VITE_`, só para a Function). Sem elas o build segue em modo localStorage. **Depois de criar: Redeploy** — as variáveis entram só no build seguinte. → **em aberto, é o próximo passo**
- ⚠️ **E2E de produção ainda não rodou** (depende das env vars): login + `/api/usuarios` criar usuário → senha provisória → login dele → troca → redefinir → limpeza.
- ⚠️ IDs de `ATIVOS` (`NOTE-001`) e de itens de estoque (`Item-001`) ainda são calculados **no cliente** a partir do espelho — dois navegadores podem gerar o mesmo código e o upsert sobrescreve. As outras 11 coleções usam blocos de sequência do servidor. → **adiado para depois da Fase C**
- ⚠️ Recarregar dados ao voltar à aba/foco (item 7 da Fase B) — **ainda pendente**.
- ⚠️ Usuário **Inativo** perde o acesso no app, mas a conta Auth continua existindo (não há `excluir` na API) — fora do escopo desta rodada.
- Permissões vigentes em `src/lib/permissions.ts` (ACESSO_ROTA) — base que o RLS da Fase D espelha.

---

## 2. Próximo grande objetivo: uso profissional

### Decisões já tomadas (com o usuário)
| Tema | Decisão |
|---|---|
| Backend | **Supabase** (recomendado; usuário pediu detalhe das 3 opções e aceitou seguir a recomendação) |
| Dados | **Começar do zero** (sem migrar demo), poucos usuários (2–10) |
| Orçamento | **Só plano grátis** (Vercel free + Supabase free tier) |
| Auth | **E-mail + senha** (sem MFA, sem login social) |

### O que ainda impede o uso profissional (pós-Fase D)
- **Produção segue em `localStorage`** (env vars da Vercel não criadas) → dados por navegador, não compartilhados
- Seed de demo continua rodando no modo local (sem env vars) — é proposital

**Resolvido na Fase D (07/10/2026):** aprovação por link virou UUID aleatório no banco (sem segredo no bundle), RLS por perfil espelhando `permissions.ts`, `anon` sem acesso a qualquer tabela, `auditoria` assinada com o e-mail do JWT, auto-promoção de perfil bloqueada, `auth_id` só pela API e restore de backup validado.

**Resolvido nas fases B e C:** dados no Supabase (modo dual), login e-mail+senha com sessão persistida e troca obrigatória de senha provisória, contas geridas por servidor (service_role fora do bundle), sequências em blocos no servidor, seed desligado no modo Supabase, `keepalive` nas escritas.

### Arquitetura atual (relevante para a migração)
- 11 stores Zustand **síncronos** usando `lerColecao`/`gravarColecao` de `src/data/repository.ts`:
  `ativos, auth, estoque, emprestimos, fornecedores, inventario, manutencao, movimentacoes, setores, solicitacoes, termos`
- `src/data/repository.ts` (48 linhas) foi desenhada para ser trocada por API — hoje já sincroniza em background (Fase B)
- `src/data/auth.ts` (sessão Supabase) e `src/data/admin.ts` (contas via Vercel Function) — Fase C
- `src/data/bootstrap.ts` — no modo local aplica `aplicarSeed()` antes dos stores carregarem; no modo Supabase **não baixa nada enquanto não houver sessão** (`baixarDados()` roda após o login)
- `src/lib/token.ts` — aprovação por UUID aleatório (`crypto.randomUUID()`) gravado em `solicitacoes.aprovacao_token`; a verificação/decisão no servidor é a RPC em `src/data/aprovacao.ts` (Fase D)
- ~15 coleções: ATIVOS, ESTOQUE, SOLICITACOES, MANUTENCOES, CONTAGENS(+ITENS), TERMOS, SETORES, FORNECEDORES, MOVIMENTACOES, EMPRESTIMOS, USUARIOS, LOG, SEQ_*

---

## 3. Plano aprovado — Implantação profissional (Supabase free tier)

### Fase A — Fundação (1º deploy) ✅ CONCLUÍDA (05/10/2026)
1. ✅ Projeto Supabase criado (`ftwaxhngujwswaauqfbn`) com e-mail+senha habilitado
2. ✅ Schema SQL versionado em `supabase/migrations/` (6 iniciais + 2 das fases B/C = 8 arquivos, ordem alfabética = ordem de execução):
   - `20261005120000_esquema_inicial.sql` — 15 tabelas: `usuarios, setores, fornecedores, ativos, estoque, entradas_estoque, saidas_estoque, solicitacoes, manutencoes, contagens+contagem_itens, termos, movimentacoes, auditoria, sequencias`
   - `20261005120100_auditoria_append_only.sql` — trigger que bloqueia UPDATE/DELETE em `auditoria` (TRUNCATE liberado p/ restore) + trigger de `atualizado_em` em 10 tabelas
   - `20261005120200_sequencias.sql` — função `proxima_sequencia(nome)` (SECURITY DEFINER, mesmo contrato do `proximaSequencia()` do app) + seed das 10 sequências
   - `20261005120300_rls_e_privilegios.sql` — RLS **ligado em todas as tabelas** com policy temporária `using (true)` (**substituída pela Fase D** por policies por perfil); `auditoria` = SELECT+INSERT; `sequencias` = SELECT só (escrita só via RPC)
   - `20261006010000_emprestimos.sql` — tabela `emprestimos` da nova aba (FK p/ `ativos`, `previsao >= data`, `unique` de empréstimo em aberto por ativo, trigger de `atualizado_em`, sequência `EMP`, RLS ligado junto com a tabela)
   - `20261006020000_ativos_configuracao.sql` — coluna opcional `ativos.configuracao` (etiqueta/QR do equipamento)
3. ✅ Constraints: `UNIQUE(codigo)` (RN001, PK + regex `AAA-000`), unicidade de setor/fornecedor case-insensitive, FKs, `movimentacoes_rn006_setores_diferentes`, `quantidade >= 0`, `data_aquisicao NOT NULL`, coluna `atualizado_em` em toda tabela editável

**Como aplicar:** no SQL Editor do Supabase, colar os arquivos em ordem alfabética (ou `supabase db push` com a CLI). Validado em Postgres 17 real via Docker: todas as constraints, triggers, RLS e cascata passaram. **As 12 migrations já estão aplicadas no banco real** (8 da Fase A/B/C + as 2 da Fase D em 07/10 + as 2 de hardening do `anon` em 08/10), com o histórico `supabase_migrations.schema_migrations` alinhado pela CLI.

### Fase B — Camada de dados ✅ CONCLUÍDA (06/10/2026)
4. ✅ `src/data/api.ts` — `DEFINICOES` (14 coleções → tabela + PK + modo), mapeamento camel↔snake, `DD/MM/AAAA`↔`AAAA-MM-DD`, numeric→number, timestamptz→ISO; `carregarTudo()` (allSettled + sequências), `sincronizarColecao()` (diff por PK → upsert / `append` p/ LOG com `ignoreDuplicates` / contagens com delete+insert de `contagem_itens`), `proximaSequenciaRemota()` (RPC)
5. ✅ **Os 11 stores não mudaram**: `src/data/repository.ts` manteve o contrato síncrono — grava o espelho na hora e dispara o sync em background (falha → toast de erro). Menos risco que refatorar stores.
6. ✅ Seed só no modo local — `bootstrap.iniciar()` virou assíncrono e o `main.tsx` monta o `App` só depois dele; no modo Supabase ele baixa as tabelas e **não** aplica seed (instância começa zerada, exceto os 4 usuários demo)
7. ❌ Recarregar ao voltar à aba/foco — **ainda pendente**

**Modo dual (decisão sua):** sem `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` o app roda 100% localStorage (seed/demo inclusive); com as variáveis liga o Supabase. `src/data/client.ts` exporta `modoSupabase` e o **modo `test` é bloqueado de propósito** — o Vitest carrega o `.env.local`, sem a trava os testes gravariam no banco de produção (foi pego no caminho; `src/data/client.test.ts` é a trava).

**Escopo extra que entrou:**
- **7ª migration** `20261006030000_reserva_sequencias.sql` (RPC `reservar_sequencia(nome, qtd)`); todas aplicadas no banco real (16 tabelas, RLS em todas, `ativos.configuracao`) + 4 usuários demo
- **Blocos de 50 IDs**: `prepararBlocos()` no boot, prefetch quando faltam 25, `garantirBloco()` no restore de backup, `Math.max` para nunca regredir contador
- **Backup**: `restaurarDemo()` é no-op no modo Supabase e o botão na Configurações fica desabilitado
- **Testes**: `api.test.ts` (10) + `repository.test.ts` (9, modo dual com `vi.mock`) + `client.test.ts` (1) → 92/92
- **E2E novo** `cdp-persistencia.mjs` (15 checks): login com usuários do banco → criar setor → criar ativo (código vindo do servidor) → POST 201 → **limpar o localStorage** → relogin → linha volta do banco → descartar → `status=Descartado` persistido → 0 erros de console → limpeza (banco termina só com os 4 usuários + 7 setores padrão)
- **Quirk descoberto:** `Descartar` é *soft delete* (`mudarStatus(…, 'Descartado')`), não apaga a linha — e o botão só aparece com a coluna de ações em modo edição
- **Quirk**: `carregarSetores()` gera os 7 setores padrão quando o espelho está vazio (é por isso que a tabela `setores` já nasce com 7 linhas no banco)

### Fase C — Login e sessão reais ✅ CONCLUÍDA (06/10/2026)
8. ✅ Login e-mail+senha (Supabase Auth) — `src/data/auth.ts` + `LoginPage`; no modo Supabase **os cards de demonstração somem** (no modo local continuam)
9. ✅ Cadastro de usuários por Admin (senha provisória → troca no 1º login) — `api/usuarios.mjs` (Vercel Function) + `src/data/admin.ts` + botão "Nova senha"; `usuarios.perfil` alimenta `permissions.ts`
10. ✅ Sessão persistida e sincronizada com `useAuthStore` — `persistSession`/`autoRefreshToken` + `restaurarSessao()` antes do boot renderizar

**Escopo extra que entrou:**
- ✅ `keepalive` nas escritas (risco adiado da Fase B) · ❌ IDs de ATIVOS/estoque por sequência (continua pendente)
- **8ª migration** `20261006040000_usuarios_auth_id.sql` (coluna + índice único) — **já aplicada no banco real** (os 4 usuários têm `auth_id`)
- Contas Auth dos 4 usuários demo já criadas e vinculadas
- `scripts/gerar-senhas.mjs` para zerar senhas de teste (service_role fora do repo)
- **Testes:** 92 → **132** (+40 em `auth`, `admin` e `store/auth`)
- **E2E:** `/tmp/opencode/cdp-login.mjs` — 21 checks, 0 falhas (roda sobre `npm run build` + `preview`)
- **Fix:** GoTrue exige `PUT` (não `PATCH`) em `/auth/v1/admin/users/{id}` → 405

### Fase D — Segurança server-side ✅ CONCLUÍDA em código (07/10/2026) — *falta aplicar no banco*
11. ✅ Aprovação por link (RN004): HMAC client-side trocado por **UUID aleatório no banco** (`solicitacoes.aprovacao_token` + `token_expira_em`, validade 7 dias) — **sem segredo no bundle**; a coluna `token` (HMAC) ficou deprecada para não quebrar link já enviado. Página pública passou a usar as RPCs `solicitacao_por_token` / `decidir_por_token`.
12. ✅ **RLS por perfil em todas as tabelas** espelhando `permissions.ts`: leitura = autenticado (exceto `auditoria` → Admin/Gerente), escrita = `pode_editar`, `setores`/`fornecedores`/`solicitacoes` → Admin/Gerente, `usuarios` → só Admin; **`anon` revogado de qualquer tabela**; papel detectado por `current_user` (`papel_requisicao()`), perfil por helper SECURITY DEFINER.
13. ✅ Validações críticas no banco: `usuarios_protegidos` (só `service_role` troca `auth_id`; perfil não se auto-altera) + `auditoria_assinada` (quem grava autenticado leva o e-mail do JWT, nunca o nome que o cliente mandar) + `bloquear_reescrita_auditoria` (já existia).
14. ✅ **Restore de backup validado**: `validarBackup` checa formato e chave primária de cada registro; `aplicarBackup` pula `USUARIOS` no modo Supabase e devolve o que foi ignorado.
15. ✅ **Comportamento testado**: `supabase/tests/rls_fase_d.sql` → 81 checagens em Postgres 17 real (anon sem tabelas, sem `execute` nas helpers e só com as RPCs, `authenticated`/`postgres` ainda executando as helpers, cada perfil gravando/bloqueando, auditoria append-only e assinada, service_role liberado) — **0 falhas**.
- ✅ **Pendência da fase resolvida (07/10/2026):** as 2 migrations foram aplicadas no banco de produção e conferidas via `supabase db query` (policies, funções, triggers e ACLs).

### Fase E — Operação
14. **Backups**: no free tier, `pg_dump` agendado via GitHub Actions (semanal) — **obrigatório** (free não tem backup automático)
15. Sentry (free) para erros
16. GitHub Action de CI (lint + tsc + vitest) além do build do Vercel

### Fase F — Go-live
17. Cadastrar usuários reais, treinar, definir RPO
18. Domínio custom opcional (grátis via Vercel) ou manter `it-stock-react.vercel.app`
19. Checklist: restore de backup testado · 0 erros E2E · token Vercel revogado · demo separada/desativada

**Esforço estimado:** Fases B–D somam mais trabalho que as 6 fases anteriores juntas; validar com E2E a cada deploy (1 deploy por fase).

---

## 4. Convenções e quirks para retomar

### Stack e comandos
- Vite 8.3 · React 19 · TS ~6 · Tailwind 4 · React Router 7 · Zustand 5 · recharts · lucide-react · oxlint · Vitest 5
- `npm run lint` · `npx tsc -b` (o `tsc --noEmit` solto **não** checa o `tsconfig.app.json`) · `npm run build` · `npm test` · `npm run preview` (porta 4173)

### E2E (Chrome headless)
- CDP porta **9225** (`curl http://127.0.0.1:9225/json/list`)
- Scripts em `/tmp/opencode/cdp-*.mjs` (ex.: `cdp-login.mjs` 21 checks · `cdp-etiquetas.mjs` 21 · `cdp-persistencia.mjs` 15)
- ⚠️ `/tmp` é limpo entre sessões — **os scripts precisam ser reescritos** quando isso acontece
- **Antes de rodar**: `pkill -f "remote-debugging-port=92[2]5"` em um comando **separado** (se o mesmo comando também lançar o Chrome, o `pkill` mata o próprio shell) — chrome órfão de execução anterior faz o script anexar no perfil velho (login já feito + dados editados = checks falsos)
- **Chrome**: `google-chrome --headless=new --no-sandbox --remote-debugging-port=9225 --user-data-dir=/tmp/opencode/chrome-perfil --window-size=1400,900 about:blank`
- **Quirks**: input React → setter nativo do prototype + `Event('input',{bubbles:true})`; select → setter de HTMLSelectElement + `Event('change')`; modal `[role=dialog]`; logout → botão `[aria-label="Sair"]` (sidebar fica no DOM mesmo oculta); `window.print()` é no-op no headless
- **Ruído aceito no login**: a tentativa de senha errada gera `400` em `/auth/v1/token` (e o Chrome loga "Failed to load resource") — o script filtra só esse caso e falha para qualquer outra 4xx/5xx
- Validar deploy: hash de `dist/assets/index-*.js` == `<script>` de `https://it-stock-react.vercel.app/`

### Datas e segurança
- Campos editáveis em `DD/MM/YYYY`; `criadoEm`/`dataHora` ISO; usar `formatarData`/`diasAte`/`dataBRparaDate` (`src/lib/format.ts`)
- `localStorage` prefixo `ITSTOCK_*`; guard `ITSTOCK_SEEDED`; sessão `ITSTOCK_SESSAO`
- Login demo: `admin@/gerente@/tecnico@/viewer@empresa.com` (cards — só modo local)
- **Supabase Auth**: senha provisória `Itstock-XXXXXXXX` + `user_metadata.trocar_senha`; zerar com `node scripts/gerar-senhas.mjs [email]` (lê `SUPABASE_SERVICE_ROLE_KEY` do `.env.local`, que é gitignored)
- **GoTrue = `PUT`** em `/auth/v1/admin/users/{id}` (`PATCH` → 405); criar = `POST /auth/v1/admin/users`; excluir = `DELETE …/admin/users/{id}`

### Padrões de código adotados
- Anti-warning de estado na renderização: `const [abertoAnterior, setAbertoAnterior] = useState(aberto); if (aberto !== abertoAnterior) { setAbertoAnterior(aberto); if (aberto) {...sets} }` — usado em todos os modais de form
- Tom de badge extraído em `src/components/ui/tom.ts` (`tomDoStatus`, `MAPA_STATUS`)
- Baseline de lint: **0 warnings** — manter assim

---

## 5. Como retomar (checklist)

1. Abrir o projeto: `cd /home/williamfeitoza/IT-Stock-Global/Projects/it-stock-react/`
2. `git status` + `git log --oneline -3` → deve estar limpo, topo `fdebae4` (Fase C) ou posterior
3. Conferir este arquivo (`PLANO-IMPLANTACAO.md`) e a seção 3
4. **Próximo passo (nesta ordem):**
   1. ✅ **2 migrations da Fase D aplicadas** (07/10/2026) — histórico alinhado pela CLI (`supabase migration repair --status applied` + `supabase db push` → *up to date*); conferência de RLS feita com `supabase db query --linked`, e o teste completo continua no `docker` descartável (`supabase/tests/rls_fase_d.sql` → 81 checks);
   2. você cria na Vercel as 5 env vars (3 do frontend + 3 da Function, ver Pendências) e clica **Redeploy**
   → eu valido o E2E de produção: hash do bundle · login com senha provisória · troca · `/api/usuarios` (criar usuário → senha provisória → login dele → troca → redefinir) → link de aprovação → limpeza
5. Rodar validação sempre: `npm run lint && npx tsc -b && npm test && npm run build`
6. E2E local sempre que mexer em login/dados: `npm run build` + `npm run preview` (4173) + Chrome na 9225 + `node /tmp/opencode/cdp-login.mjs "<provisória>"`
7. Deploy: commit + push na `main` → Vercel auto-deploy (~12s) → validar hash + smoke E2E
8. Ao final: revogar token da Vercel

### Pendências conhecidas
- ✅ ~~Aplicar as 2 migrations da Fase D no Supabase~~ — **feito em 07/10/2026** (banco conferido: 0 policies temporárias, `anon` sem acesso a tabela).
- ⚠️ **Remover a coluna `solicitacoes.token` (HMAC deprecada)** depois que nenhum link antigo estiver em circulação: `alter table public.solicitacoes drop column token;`
- ⚠️ **Revogar o token da Vercel** (`vcp_8aAoy...`) usado nos deploys.
- ⚠️ **Env vars da Vercel + E2E de produção** — enquanto não existir, produção roda em localStorage e `/api/usuarios` responde 500.
- ✅ **Ordem do deploy da Fase D**: migrations já estão no banco (07/10) — sobra só o deploy do frontend com as env vars.
- ⚠️ IDs de `ATIVOS` e de itens de estoque calculados no cliente; recarregar ao voltar à aba/foco; conta Auth de usuário Inativo não é excluída — pós-Fase C.
