# PLANO DE IMPLANTAÇÃO E PONTO DE RETOMADA

> Documento de continuidade — **última atualização: 13/10/2026 (pendências da Fase C fechadas: IDs por sequência do servidor + recarga ao voltar à aba)**
> Leia este arquivo para continuar de onde paramos.

---

## 1. Estado atual do projeto

**Repo:** `https://github.com/wafeitoza/Sistema-de-T.I.git` (branch `main`)
**Produção:** https://it-stock-react.vercel.app (bundle `App-CY5piBLw.js` = pendências da Fase C fechadas, **modo Supabase real desde 08/10/2026**)
**Diretório:** `/home/william/Projetos/Projetos AI/Sistema de T.I NTE/`

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
| — | `444b09e` | **Recarrega os dados ao voltar à aba** (item 7 da Fase B, pendente desde o modo dual) |
| — | `d488999` | **IDs de ativo e de item de estoque saem da sequência do servidor** (pendência adiada na Fase C) |

### Qualidade (validado na última entrega — 13/10/2026)
- `npm run lint` → **0 warnings, 0 erros**
- `npx tsc -b` → OK (`tsc --noEmit` na raiz não checa `tsconfig.app.json` — **use `tsc -b`**)
- `npm test` → **180/180** (Vitest + happy-dom; +12 da camada de erros: 8 em `erros.test.ts` e 4 no `ErrorBoundary.test.tsx` — o include do vitest passou a aceitar `.tsx`, habilitando teste de componente)
- `npm run build` → OK (`tsc -b` incluído)
- **RLS em Postgres 17 real (Docker)**: `supabase/tests/rls_fase_d.sql` → **81 checagens, 0 falhas** (rodada de novo em 13/10 sobre as 14 migrations)
- **RLS do exterior (13/10/2026, só com a chave pública, contra produção)**: 8 checks, 0 falhas — `anon` → 401 em `ativos`/`auditoria`/`usuarios`/`sequencias` e INSERT negado; `proxima_sequencia`/`reservar_sequencia` → `42501 permission denied`; `solicitacao_por_token` → 200 (link público intacto).
- **Backup do banco (13/10/2026)**: dump de 16 KB / 2195 linhas SQL, round-trip verificado, e **restore testado num Postgres 17 descartável** — 16 tabelas `public` + `auditoria` 85 + `sequencias` 26 + `usuarios` 5 + `fornecedores` 2 + 5 contas `auth` com hash bcrypt.
- E2E Chrome headless: local e produção com **0 erros de console**
  - **produção 13/10/2026: `/tmp/opencode/e2e-prod.mjs` 18 checks, 0 falhas** — produção em modo Supabase **sem cards de demonstração** → login real com conta temporária → 2 ativos (`NOTE-001`, `NOTE-002`) → item de estoque (`Item-001`) → **foco disparando 30 requisições ao servidor** → debounce de 30 s segurando o 2º disparo (0 requisições) → F5 mantém o código → 0 erros de console e 0 respostas 4xx/5xx. **Achou e corrigiu o bug do bloco de sequência** (`740d136`).
  - modo local 13/10/2026: **`/tmp/opencode/e2e-local.mjs` 13 checks, 0 falhas** — login por card → criar 2 ativos (`NOTE-004` sobre o seed `NOTE-001..003`) → criar item de estoque (`Item-007`) → dispatch de `visibilitychange`/`focus` sem quebrar nada → F5 mantém o código
  - **produção 13/10/2026 (exclusão de usuário): `/tmp/opencode/e2e-excluir-prod.mjs` 16 checks, 0 falhas** — login real → criação da vítima **pela UI** (prova o insert em `usuarios` sob RLS) → Excluir → modal → remoção → F5 → 0 erros de console. Conferido por service_role que **conta Auth e cadastro sumiram** e que a auditoria registrou CREATE + DELETE. Mesmo fluxo em modo local: `check-excluir-usuario.mjs` 12 checks, 0 falhas (botão ausente na própria linha, modal, persistência no F5).
  - últimas rodadas antigas de produção: **08/10/2026 — `cdp-prod-supa.mjs` 21 + `cdp-prod-supa2.mjs` 19 + `cdp-prod-supa3.mjs` 14 = 54 checks, 0 falhas** · `cdp-fase-d.mjs` 13 · `cdp-login.mjs` 21 · `cdp-etiquetas.mjs` 21 · `cdp-persistencia.mjs` 15

### Estado do Git
`main` sincronizada com `origin/main`; último código: **`630d277`** (exclusão de usuário), seguido dos commits de documentação do mesmo dia.
**Produção em modo Supabase real desde 08/10/2026**: env vars criadas na Vercel + Redeploy, bundle
com a URL do projeto e a chave publishable embutidas (a `sb_secret_` **não** vaza —
o único `sb_secret_` do bundle é a string literal do prefixo dentro do próprio `supabase-js`).
As 14 migrations estão aplicadas no banco de produção (histórico `upToDate: true`).
**O E2E de produção completo rodou em 13/10/2026 (18/18)** e o banco está **zerado e pronto para o
go-live real**: 0 ativos, 0 estoque, 26 sequências em 0 (o primeiro ativo real sai `NOTE-001`),
5 contas Auth com senha provisória. O backup semanal está no ar (primeira rodada agendada:
segunda 19/10/2026, 06:30 UTC).

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
- `20261008030000_remove_token_hmac.sql` (aplicada em 08/10/2026) — **estabilização**: `alter table solicitacoes drop column token` (a coluna HMAC deprecada). Verificado antes de dropar que ninguém mais a lê: as RPCs usam `aprovacao_token` + `token_expira_em`, o tipo `Solicitacao` do app não tem o campo, o mapeamento de colunas não a envia e a suíte não a cita. Validação: Docker 13/13 migrations → suíte **81/81** · produção: coluna removida, histórico 13/13, E2E do fluxo de aprovação **19/19**.

**No app:**
- `src/lib/token.ts` — token agora é `crypto.randomUUID()` gravado em `solicitacoes.aprovacao_token` (+ `token_expira_em`); **nenhum segredo no bundle**. A coluna antiga `token` (HMAC) era deprecada de propósito para não quebrar link já enviado durante o deploy — **removida em 08/10/2026** pela migration `20261008030000_remove_token_hmac.sql`.
- `src/data/aprovacao.ts` (novo) — consultas/decisões por RPC, sem ler tabela.
- `src/pages/solicitacoes/AprovacaoPage.tsx` — usa as RPCs no modo Supabase; no modo local continua lendo o espelho. Expiração conferida no mount (render puro).
- `src/data/bootstrap.ts` — **não baixa nada sem sessão**; `baixarDados()` roda após o 1º login e chama `recarregarTodasAsLojas()` (`src/store/recarregar.ts`, novo). Resultado: sem sessão o app sobe instantâneo e sem toast de erro.
- `src/pages/DashboardPage.tsx` — card "Atividade recente" só aparece para quem acessa `/auditoria`.
- `src/lib/backup.ts` — `validarBackup` valida **formato de cada registro e chave primária**; `aplicarBackup` devolve `{ ignoradas }` e **pula `USUARIOS` no modo Supabase** (contas são do servidor).

**Como validar (tudo já rodou aqui):**
```bash
npm run lint && npx tsc -b && npm test && npm run build   # 0 warnings, 143/143
# RLS em Postgres 17 (receita no topo de supabase/tests/rls_fase_d.sql) — 81/81
docker exec -i pg-rls psql -U postgres -d itstock -v ON_ERROR_STOP=1 < supabase/tests/rls_fase_d.sql
```
**RLS do exterior (rodado em 08/10/2026, só com a chave pública)**: `anon` → 401 em `/ativos` e `/auditoria`,
401 nas 6 helpers e em `proxima_sequencia`, OpenAPI sem nenhuma tabela exposta, `INSERT` negado — e
`200` em `solicitacao_por_token` (o link público continua funcionando) · `service_role` → `200` em
`/usuarios`. **8 checks, 0 falhas** (script em `/tmp/opencode/testa-rls-externo.sh`).

**Ordem de deploy (importa):** 1) ✅ aplicar as 2 migrations (feito em 07/10/2026) → 2) ✅ criar as env vars da Vercel e Redeploy (feito em 08/10/2026) → 3) ✅ produção validada em modo Supabase (E2E 54/54 em 08/10/2026).

**CLI do Supabase (07/10/2026 · atualizado em 13/10/2026):** `npm i -g supabase` → `supabase login` → `supabase init` (cria `supabase/config.toml` + `supabase/.gitignore`, ambos versionados) → `supabase link --project-ref ftwaxhngujwswaauqfbn`. Como as 8 primeiras migrations entraram pelo SQL Editor, o histórico remoto estava vazio e o `db push` queria reaplicar as 10 — feito *baseline* com `supabase migration repair <versão> --status applied` (8×) e depois as 2 novas entraram via `db push`. Tudo pela Management API, **sem precisar da senha do banco**. Fluxo de migration: `supabase db push --dry-run` → `db push` → conferir com `supabase db query --linked`. **Gotchas de 13/10:** o token vai **pelo stdin** (`printf '%s' "$PAT" | supabase login`), nunca em argv (aparece na lista de processos); `supabase logout` pede confirmação e morre em output JSON — usar **`supabase logout --yes`**; e a Management API **não aceita o próprio PAT** para revogação (`DELETE /platform/profile/access-tokens/{id}` → `401 "Unsupported access token"`) — revogar é sempre no dashboard.

### Funcionalidade nova (13/10/2026) — **pendências da Fase C fechadas**

Duas pendências que o plano arrastava desde a Fase B/C foram fechadas. Nada mudou visualmente.

**1. Recarrega os dados ao voltar à aba** (item 7 da Fase B — `444b09e`)
- `src/data/foco.ts` (novo) — escuta `visibilitychange` (só quando `visible`) e `window.focus` e chama `baixarDados()`, que já baixa as 14 coleções, re-lê os stores (`recarregarTodasAsLojas`) e reserva blocos de ID.
- **Duas proteções, porque o free tier cobra cada chamada**: no máximo **1 download a cada 30 s** (`INTERVALO_RECARREGA_MS`) e **nada roda sem sessão** (com o RLS da Fase D o `anon` não lê nenhuma tabela — download sem sessão só geraria 401). Há também trava de "recarga em andamento".
- Instalado no `App.tsx` via `useEffect` com cleanup; **no-op no modo local** (o localStorage não muda em outro navegador).
- **Testes**: `src/data/foco.test.ts` (6 casos, fake timers) — debounce, sem sessão, recarga em andamento, cleanup, modo local.
- ⚠️ **Limitação honesta**: um download sobrescreve o espelho com o estado do servidor. A escrita local é imediata (fire-and-forget), então a janela de conflito é de milissegundos — mas se um dia existir escrita offline fila, este listener precisa olhar isso. Hoje não existe.

**2. IDs de ativo e de item de estoque saem da sequência do servidor** (`d488999`)
- **O problema**: `NOTE-001` e `Item-001` eram calculados **no cliente** varrendo o espelho. Duas pessoas abrindo o mesmo formulário geravam o mesmo código e o `sincronizarColecao` (diff por PK → upsert) **sobrescrevia o registro da outra** — perda silenciosa de dados. As outras 11 coleções já usavam blocos de sequência atômicos.
- **Migration** `20261013100000_sequencias_ativos_estoque.sql` — cria 14 sequências `ATV_<prefixo>` (uma por tipo de ativo, os mesmos 14 prefixos de `PREFIXOS`) + `ITEM`, **semeadas no maior código já existente no banco** (`substring` com regex + `greatest(sequencias.valor, excluded.valor)` no `on conflict`). Sem o seed no maior valor real, o próximo notebook viraria `NOTE-001` de novo e colidiria com o que já está lá. **Sem função nova → sem o gotcha do `anon`** (nenhum revoke a fazer; a escrita continua só via `reservar_sequencia`, já revogada do `anon`).
- **App**: `nomeSequenciaAtivo(tipo)`/`SEQUENCIA_ITEM`/`formatarCodigoAtivo`/`formatarCodigoItem` em `codes.ts` (formatador **único** para os dois modos) · `NOMES_SEQUENCIA` em `api.ts` ganhou os 15 nomes · `criar()` de `ativos.ts` e `criarItem()` de `estoque.ts` passaram a consumir `proximaSequencia()` no modo Supabase; **no modo local continua saindo do espelho**.
- **Backup**: `SEQUENCIAS_BACKUP` passou a ser **derivada de `NOMES_SEQUENCIA`** — as duas listas não podem divergir, senão um restore re-emite código já usado. Restore de backup antigo (só 11 sequências) **não regride** o valor (`Math.max` + `garantirBloco`, já era assim).
- **Testes**: `src/store/identificadores.test.ts` (6 casos, mock do repository — os 2 modos) + `codes.test.ts` (+4) + `backup.test.ts` (+2) → 161/161.
- **Validação**: Docker Postgres 17 com as 14 migrations → sequências conferidas com dados de verdade (`NOTE-017`/`MON-002`/`CPU-099`/`Item-011` → próximo bloco começa em 18/2/100/12) · suíte **RLS 81/81** · produção: `db push` → histórico **14/14, `upToDate: true`**, 15 sequências no banco (banco segue zerado de ativos/estoque, como decidido na Fase A).
- **Gotcha do boot**: `prepararBlocos()` hoje reserva **26** blocos (11 + 15), uma chamada por nome. Se algum dia o boot ficar lento, é o primeiro suspeito — dá para agrupar os `ATV_*` numa RPC só.

### Funcionalidade nova (13/10/2026) — **Fase E item 14 e E2E de produção**

Três entregas da tarde de 13/10/2026, todas motivadas pela continuação automática das Fases E e F.

**1. Backup do banco consertado** (`f517af6`) — *Fase E, item 14*
- **O problema**: a rodada agendada de 12/10 (run [38273938404](https://github.com/wafeitoza/Sistema-de-T.I/actions/runs/38273938404)) falhou em 15s porque o secret `SUPABASE_DB_URL` nunca tinha sido criado e a senha do banco não estava à mão. **Desde então o banco ficou sem backup algum**, e o free tier do Supabase não tem backup automático.
- **O desenho novo**: `supabase db dump` passa pela **Management API**, então funciona só com um PAT — sem connection string, sem prompt, sem senha do banco. `scripts/backup-postgres.sh` agora aceita os dois caminhos, na ordem: `SUPABASE_DB_URL` (pg_dump direto, dump mais completo) e `SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF` (CLI, o que roda hoje). O round-trip (decripta + descomprime) continua **obrigatório**: se o dump não abrir, o workflow falha agora, não numa restauração de emergência.
- **Gotcha que custou uma investigada**: `supabase db dump` **sem flag devolve só o schema** (16 `CREATE TABLE`, 0 `INSERT`). Backup de verdade é `schema` + `--data-only` **concatenados, schema primeiro**. O script agora confere que o schema não veio vazio antes de criptografar.
- **Validado ponta a ponta nesta máquina**: `backup-2026-10-13.sql.gz.gpg` · 16 KB · 2195 linhas SQL · round-trip OK. **RESTORE num Postgres 17 descartável**: 16 tabelas `public` + `auditoria` 85 + `sequencias` 26 + `usuarios` 5 + `fornecedores` 2, e as 5 contas `auth` (incl. *william*) com **hash bcrypt dentro do dump**. Os 143 erros do restore são todos de infraestrutura Supabase que não existe num Postgres puro (papéis `anon`/`authenticated`/`service_role`, schema `extensions`, tabelas `auth.*`, publication do realtime) — **no projeto real elas existem**.
- **Workflow**: run [38413884138](https://github.com/wafeitoza/Sistema-de-T.I/actions/runs/38413884138) verde em 48s, artefato 13 KB com retenção de 90 dias.
- ⚠️ **O PAT virou secret do repo** (`SUPABASE_ACCESS_TOKEN`) e por isso **não deve ser revogado** — a rodada semanal depende dele. É de acesso total à conta e não expira; se um dia o repo for privatizado ou houver vontade de estreitar, basta criar o secret `SUPABASE_DB_URL` (pooler, porta 6543): o script trata os dois caminhos e **prefere** o DB_URL.

**2. E2E de produção completo — 18/18, 0 falhas** — *Fase F, item 19*
- `scripts/e2e-usuario.mjs` cria/apaga a conta temporária (`e2e-teste@empresa.com`) via service_role: precisa de conta Auth **e** linha em `public.usuarios`, porque o RLS da Fase D faz o login ler o perfil do espelho. Sem `user_metadata.trocar_senha`, senão a tela de troca travaria o fluxo.
- **Gotcha**: a tabela `usuarios` **não tem coluna `id`** (a chave é o e-mail). Um `select=id` devolve `42703` e um script ingênuo trata o corpo de erro como "já existe" e **pula o insert em silêncio** — o login depois cai em "Usuário não encontrado ou inativo". Foi exatamente isso na primeira tentativa.
- O script `/tmp/opencode/e2e-prod.mjs` (reescrito nesta sessão; o `/tmp` zera entre sessões) cobre: produção em modo Supabase **sem cards de demonstração** → login real → ativos com código da sequência do servidor → item de estoque → **foco disparando download real** → debounce segurando o 2º disparo → F5 → 0 erros de console e 0 respostas 4xx/5xx.

**3. 🐛 Bug achado pelo E2E e corrigido** (`740d136`)
- **Sintoma**: o primeiro ativo do sistema saiu `NOTE-051` (e o item `Item-051`) em vez de `NOTE-001`; a sequência do servidor foi de **0 a 250** com 3 registros criados.
- **Causa 1**: `prepararBlocos()` reservava um bloco de 50 para as 26 sequências a **cada** `baixarDados()` — login, volta de aba e F5. Como o foco foi ligado no mesmo dia, **cada volta de aba queimava 26 × 50 = 1300 números**. Agora reserva só onde o bloco está ausente ou no fim (mesmo critério do `garanteReserva`, extraído para `blocoInsuficiente`).
- **Causa 2**: `carregarSequencia()` empurrava o contador local para o topo do servidor, que frequentemente **era o bloco que acabávamos de reservar e ainda não tínhamos usado** — daí o salto 0 → 51. Agora é no-op quando este cliente já tem bloco: **bloco exclusivo é nosso até o fim**, mesmo que outro navegador já tenha ido além (sem colisão, porque a reserva nova volta do servidor acima do topo alheio).
- **Regressão coberta** por 3 testes novos em `repository.test.ts` → 164/164. **Confirmado em produção após deploy**: `NOTE-001`, `NOTE-002`, `Item-001`, e o consumo do servidor caiu de **250 → 100** (2 blocos: login + pós-F5, o mínimo para blocos em memória).

### Funcionalidade nova (13/10/2026) — **valores só no inventário** e **exclusão de usuário**

**Valores monetários só no `/inventario`** (`d7956a4`, `d47a5a1`) — pedido do usuário: *"o único lugar que preciso saber dos valores"*.
- Removidos: os 2 cards do hero do Dashboard (Patrimônio / Valor em estoque), o card "Valor em estoque" do `/estoque`, o card "Patrimônio" **e** a linha "Patrimônio (aquisição)" do CSV do `/relatorios`. Grids de 4 → 3 cards. Os gráficos de relatórios nunca tiveram valores (só contagens).
- Voltou como card no `/inventario`, na aba **Relatório de ativos** (a aba padrão é "Contagem", que não tem cards de valor): "Valor em estoque" ao lado de "Valor total", grid 4 → 5. O cálculo é **global** — os filtros da página são de ativos (status/setor/tipo), não de item de reposição.
- Formulários intactos ("Valor de aquisição" no ativo, "Preço unitário" no item): sem eles não há valor para somar.
- Consequência assumida com o usuário: o valor de estoque passou a existir em um lugar só, o inventário.
- Conferido no bundle de produção: `Valor em estoque` = 1 ocorrência (só inventário), `Patrimônio` = 0.

**Exclusão de usuário** (`630d277`) — pedido: *"adicione a função de excluir usuário"*. Até aqui só existiam criar/redefinir; apagar só dava pelo `scripts/e2e-usuario.mjs`.
- `api/usuarios.mjs` ganhou a ação **`excluir`**: apaga a conta no Supabase Auth **e** a linha em `usuarios` (decisão do usuário — "Inativo" continua para só desativar).
- **Ordem Auth → cadastro** de propósito: numa falha no meio, o pior caso possível é o cadastro órfão, que não concede login — nunca uma conta viva sem perfil. `404` do GoTrue é tratado como sucesso, o que torna a exclusão **repetível** após falha parcial. Não há rollback (não se recria conta apagada), então a falha no cadastro vira erro explícito + e-mail no `console.error` do servidor.
- **Autoexclusão bloqueada no servidor** (`email === chamador.email` → 400), não só escondendo o botão: um Admin que se apaga deixaria o sistema sem ninguém para gerenciar usuários.
- `src/data/admin.ts`: `apagarConta(email)`. `UsuariosPage`: botão **Excluir** por linha (ausente na própria) + modal no padrão FornecedoresPage. O modal **não fecha em erro** de propósito — um erro do tipo "a conta foi apagada mas o cadastro não" pede repetição.
- **Não há FK para `usuarios`** e `responsavel` é texto livre → apagar alguém não quebra histórico algum; a exclusão fica registrada na auditoria (`acao: DELETE`).
- **Validação**: lint 0 warnings · `tsc -b` · **168/168 testes** (4 novos em `admin.test.ts`) · build · E2E local 13/13 · checagem do fluxo em modo local 12/12 · **E2E de produção 16/16** com login real, criação da vítima pela UI (prova o insert em `usuarios` sob RLS) e exclusão pela UI. Conferido por service_role que **conta Auth e cadastro sumiram** e que a auditoria registrou CREATE + DELETE. Conta temporária apagada no fim.

### Funcionalidade nova (14/10/2026) — **Sentry (Fase E, item 15) e ErrorBoundary**
Pedido: *"sentry free para erros"*. Entregue como **código pronto, DSN depois** — o repositório não fica esperando a conta ser criada.

- **`src/data/erros.ts`**: `iniciarErros()` / `reportarErro()` / `errosAtivos()`. Só importa o SDK se `VITE_SENTRY_DSN` existir; sem ela o comportamento é **exatamente** o antigo (console + aba Auditoria).
- **`src/components/ui/ErrorBoundary.tsx`** — melhoria de resiliência que veio junto e é útil **mesmo sem Sentry**: antes não existia boundary nenhum no `src/`, então um erro de render derrubava a árvore inteira e o usuário ficava com **tela branca e sem saída**, sem nem o console apontar a origem. Agora aparece "A tela encontrou um erro" + **Recarregar**, com o erro indo para o console **e** para o Sentry (quando ativo) junto da pilha de componentes e da página. Fica em volta do `<App/>` no `main.tsx`, fora do `StrictMode`.
- **LGPD garantida por teste, não por intenção**: o sistema guarda nome, e-mail, setor e telefone de servidores, então o `beforeSend` apaga **todo evento** de `request` (URL, headers, cookies) e `user` (nome, e-mail), e não existe `setUser` em lugar nenhum do código. Há teste cobrindo exatamente isso.
- **Custo medido no build**: **323 KB gz sem DSN** (SDK ausente do bundle) vs. **469 KB gz com** (+145 KB, em chunk próprio `esm-*.js`). Só exceções (`tracesSampleRate: 0`) e falha do SDK não derruba o boot.
- ⚠️ **Ativação = colar a DSN + Redeploy** — detalhe fácil de cair: o Vite embute a variável em tempo de build e, enquanto ela não existe, o `import('@sentry/react')` é removido por tree-shaking. Salvar a env var no Vercel **sozinha não faz nada** até o próximo deploy.
- **Teste do domínio (item 18) — sem mudança de código**: não há URL hardcoded em `src/`, `api/` ou `scripts/`; `montarLinkAprovacao` usa `window.location.origin` e `/api/usuarios` é same-origin.
- **Validação**: lint 0 warnings · `tsc -b` · **180/180 testes** (+12) · build · E2E local 13/13.

### Funcionalidade nova (14/10/2026) — **ícone do sistema: avatar WAF**
Pedido: *"use essa imagem para o icone da aplicação"*. Fonte: `~/Downloads/WAFicon_converted.png` (1024×1536, RGB opaco, **sem alfa**). Antes o ícone era um quadrado azul com glyph `Package` — que já divergia do app, que usa `Boxes`.

- **Composição**: recorte quadrado `800x800+120+175`, enquadrando boné + rosto. Testei antes de decidir: um corte de 730 apertava a aba do boné à esquerda e a orelha à direita; o 800 cabe inteiro com folga.
- **Os glifos decorativos das bordas não são removíveis** sem cortar o boné — o brilho ciano do personagem e os glifos têm a mesma cor, então não separam por cor. Ficam: somem a 16 px e leem como textura de estilo a 128 px.
- **Tile branco com cantos arredondados a 22%** (mesmo espírito do anterior, `rx=14` sobre 64), **com transparência nos cantos** — o fundo escuro da aba atravessa e o ícone lê como avatar deliberado, não como quadrado branco. (Primeira tentativa saiu RGB opaco; o `-compose DstIn` com preto-sobre-preto não gera alfa — corrigido com máscara `xc:none` + `-compose CopyOpacity`.)
- **Arquivos gerados com o ImageMagick já instalado** — nenhuma dependência nova no projeto:
  `favicon.ico` (16/32/48 embutidos) · `favicon-32.png` · `apple-touch-icon.png` (180, opaco — iOS exige) · `icon-192.png` · `icon-512.png` · `icon-maskable-512.png` (obra a 78% sobre branco, dentro da zona segura do Android).
- **Saiu `public/favicon.svg`**: raster não vira SVG vetorial de verdade, e embutir em base64 seria peso por nada. O `<link type="image/svg+xml">` saiu junto do `index.html`, senão viraria 404.
- **`icon-192`/`icon-512` deixaram de ser órfãos**: não existia manifest e nada os referenciava. Agora há `public/manifest.webmanifest` (`start_url: "/"`, `display: standalone`, `theme_color: #007aff`) — e o app ficou **instalável**.
- **Sem service worker, de propósito** — é o que evita a armadilha clássica do PWA servindo bundle velho.
- **O logo interno (Sidebar e login) continua com o glyph `Boxes`** — decisão do usuário, trocar só a aba do navegador. Ou seja, aba e app mostram coisas diferentes, deliberadamente.
- **Validação**: lint 0 warnings · `tsc -b` · **180/180 testes** · build OK · todos os 7 assets respondem. **Armadilha de verificação**: `/favicon.svg` ainda responde `200`, mas é o **fallback SPA** servindo `index.html` (`text/html`) — confira o `Content-Type` ou os magic bytes, senão o 204/200 mente.
- ⚠️ **Cache**: favicon é cacheado com teimosia. Ctrl+Shift+R, e abas antigas podem mostrar o ícone velho por um tempo.

Para regerar a partir da fonte (ImageMagick):
```bash
magick fonte.png -crop 800x800+120+175 +repage base800.png
magick -size 512x512 xc:none -fill white -draw "roundrectangle 0,0,511,511,112,112" mk.png
magick base800.png -resize 512x512 mk.png -compose CopyOpacity -composite icon-512.png
magick icon-512.png -define icon:auto-resize=16,32,48 favicon.ico
```

### Funcionalidade nova (14/10/2026) — **logo da tela de login é o avatar**
Pedido: *"troque o icone da tela de login por esse que te mandei"*. Antes era o glyph `Boxes` dentro de um tile de gradiente azul. Agora é o **mesmo avatar do favicon** (recorte 800×800), tile branco com `rounded-2xl` — para aba e login falarem a mesma língua.

- **`src/assets/logo.png` (256×256) com import ES, não `public/`**: o Vite agrega hash no nome (`logo-CLAy1ECY.png`), então trocar a imagem no futuro **derruba o cache sozinho**. Em `public/` ela cachearia com teimosia — exatamente o problema do favicon que eu acabei de avisar.
- **Quadrado e opaco de propósito**: o arredondamento é do CSS (`rounded-2xl` + `overflow-hidden`), então a imagem não precisa de alfa.
- **`src/vite-env.d.ts` ganhou `/// <reference types="vite/client" />`** — sem ele o `tsc -b` **reprovava** o import de `.png`, por não haver declaração de módulo para assets. Esse reference também cobre os tipos de `VITE_*`.
- **`alt=""` no `<img>`**: o `<h1>` ao lado já diz "IT Stock & Inventory"; anunciar o logo duplicaria a leitura para quem usa leitor de tela.
- **`Boxes` saiu do import** do `lucide-react` no `LoginPage` (só existia ali) — o oxlint `--deny-warnings` reprovaria por não usado.
- **Ficam 3 marcas agora**: favicon e login com o avatar, **Sidebar continuando com `Boxes`** (decisão do usuário de trocar só o login). Unificar o Sidebar seria a mesma troca em cinco linhas.
- **Validação**: lint 0 warnings · `tsc -b` · **180/180 testes** · build OK · asset no `dist/assets/` com hash e referenciado no `App-*.js` · **E2E local 13/13, 0 erros de console** · screenshot da tela de login conferido visualmente.
- ⚠️ **Pegadinha operacional**: rodar `pkill -f "vite previe[w]"` **no mesmo comando** que lança o preview mata a própria shell — o padrão casa com o `npx vite preview` que está no texto do comando invocador. Separe em comandos (aconteceu uma vez; o `.env.local` sobreviveu só porque o `pkill` veio antes do `rm`).

### Pendências / cuidados
- ✅ **2 migrations da Fase D aplicadas no Supabase** (07/10/2026) e verificadas no banco real: 47 policies (16 `_leitura` / 14 `_escrita` / 16 `_service_role` / `auditoria_insere`), **0** policies `*_temporario`, `anon` com **0** privilégios de tabela e **0** policies, `proxima_sequencia`/`reservar_sequencia` **sem** `execute` para `anon` (e sem `PUBLIC`), e as 2 RPCs do link **com** `execute` para `anon`.
- ✅ **Hardening do `anon` (08/10/2026)**: teste externo com a chave pública achou 4 helpers (`perfil_atual`, `e_admin`, `pode_editar`, `papel_requisicao`) respondendo 200 para `anon` — causa raiz: o `pg_default_acl` do `supabase_admin` granta `execute` direto no `pg_proc.proacl` de toda função nova. 2 migrations novas (`20261008010000_anon_sem_helpers.sql` + `_supabase.sql`) revogaram `public` **e** `anon` e regraram o `execute` só para `authenticated`/`service_role`. Agora o teste externo dá **8/8**: 6 helpers → 401, só `solicitacao_por_token` → 200.
- ✅ **PAT do Supabase revogado** (`sbp_fc1a77d1…`, 08/10/2026): revogado no dashboard e **confirmado por teste** — `GET /v1/projects` passou de 200 → `401 Invalid access token` e o `supabase projects list` falhou igual; `supabase logout` em seguida removeu `~/.supabase/access-token` do local. A revogação não dava para fazer pela API: o endpoint `DELETE /platform/profile/access-tokens/{id}` responde `401 "Unsupported access token"` para o próprio PAT (só aceita a sessão OAuth do dashboard). **Efeito prático: daqui pra frente `supabase db push` exige `supabase login` com um PAT novo.**
- ✅ **Token da Vercel revogado/eliminado** (08/10/2026): conferido na UI (`vercel.com/account/settings/tokens`) — o token `vcp_8aAoy…` **não consta** na lista (`All`/`Active`/`Expired`) e a aba `Revoked` está vazia; usuário confirmou a eliminação. Não deu para provar por API: a Vercel não expõe o valor depois da criação, não há cópia local (o Vercel CLI nunca logou) e o endpoint `DELETE /v3/user/tokens/current` exige o token em mãos. **Nesta mesma conferência foi achado e eliminado pelo usuário um token de CLI antigo que ainda estava ativo** (`Vercel CLI on iMac de William.sec.ba.gov.br via GitHub`, criado 08/08/2025, *Never expires*). Se existir mais de uma conta Vercel, vale repetir a conferência na outra.
- ✅ **Env vars da Vercel criadas** (08/10/2026): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (as 3 últimas sem prefixo `VITE_`, só para a Function) + Redeploy.
- ✅ **E2E de produção em modo Supabase rodou** (08/10/2026): 54 checks, 0 falhas — login por e-mail/senha com provisória, troca obrigatória (modal incontornável), dados vindos do banco nas 6 rotas, sessão persistente, solicitação → link UUID → aprovação → uso único → token inválido, `/api/usuarios` criar/redefinir + **Visualizador negado com 403**, perfis sem acesso indevido, **0 erros de console**.
- 🐛 **2 bugs de produção encontrados e corrigidos pelo E2E** (commits `4aded49` e `ff8c46c`): (1) o boot anônimo gerava o seed de SETORES e tentava subi-lo como `anon` → 401 + toast; agora `sincronizar()`/`reservar()` exigem sessão (guarda em `repository.ts`); (2) o sync da auditoria usava upsert e o Postgres exige **SELECT** da linha conflitante para detectar conflito, mas `auditoria_leitura` é `pode_gerenciar()` → o login de um Visualizador dava 403 e nunca era auditado; agora é INSERT puro com 23505 tratado como "já existe".
- ✅ ~~IDs de `ATIVOS` e de itens de estoque calculados no cliente~~ — **fechado em 13/10/2026** (migration `20261013100000` + stores consumindo `proximaSequencia()`; ver "Funcionalidade nova (13/10/2026)").
- ✅ ~~Recarregar dados ao voltar à aba/foco (item 7 da Fase B)~~ — **fechado em 13/10/2026** (`src/data/foco.ts`, debounce 30 s, guarda de sessão).
- ✅ ~~Conta Auth de usuário **Inativo** não é excluída~~ — **fechado em 13/10/2026**: a ação `excluir` entrou na `api/usuarios.mjs` e no `/usuarios` (apaga a conta Auth **e** o cadastro; autoexclusão bloqueada no servidor). Pela UI um Admin já consegue limpar contas inativas — vira rotina de administração, não mais dívida de código.
- ✅ ~~**E2E de produção não rodou em 13/10**~~ — **rodado em 13/10/2026**: 18 checks, 0 falhas, 0 erros de console (ver "Funcionalidade nova (13/10/2026) — Fase E item 14 e E2E de produção"). Achou e corrigiu o bug do bloco de sequência (`740d136`).
- ✅ ~~**`Backup do banco` falhando no Actions**~~ — **consertado em 13/10/2026** (`f517af6`): dump pela Management API com o PAT, sem a senha do banco. Rodada manual verde ([38413884138](https://github.com/wafeitoza/Sistema-de-T.I/actions/runs/38413884138)) + **restore validado num Postgres 17 descartável** (16 tabelas, 5 contas auth com bcrypt). Próxima rodada agendada: **segunda 19/10/2026, 06:30 UTC**.
- ⚠️ **O PAT `sbp_fc78582b…` NÃO deve mais ser revogado** — virou o secret `SUPABASE_ACCESS_TOKEN` e a rodada semanal de backup depende dele. É de acesso total e não expira. Para estreitar no futuro: criar o secret `SUPABASE_DB_URL` (pooler, porta 6543) e revogar o PAT; o script trata os dois caminhos e prefere o DB_URL.
- ⚠️ Permissões vigentes em `src/lib/permissions.ts` (ACESSO_ROTA) — base que o RLS da Fase D espelha.

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
- **Seed de demo** continua rodando só no modo local (sem env vars) — é proposital; em produção o banco começa zerado e o seed de SETORES sobe sozinho no primeiro login.
- ⚠️ **Conhecido (não bloqueante)**: `sincronizarColecao` usa upsert nas 13 coleções normais; se um perfil gerar alteração local numa tabela em que ele não tem `UPDATE`, o upsert volta 403 (a UI não permite isso hoje — é só um limite a lembrar se surgir escrita offline).

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
2. ✅ Schema SQL versionado em `supabase/migrations/` (6 iniciais + 2 das fases B/C = 8 arquivos iniciais; hoje são **13**, ordem alfabética = ordem de execução):
   - `20261005120000_esquema_inicial.sql` — 15 tabelas: `usuarios, setores, fornecedores, ativos, estoque, entradas_estoque, saidas_estoque, solicitacoes, manutencoes, contagens+contagem_itens, termos, movimentacoes, auditoria, sequencias`
   - `20261005120100_auditoria_append_only.sql` — trigger que bloqueia UPDATE/DELETE em `auditoria` (TRUNCATE liberado p/ restore) + trigger de `atualizado_em` em 10 tabelas
   - `20261005120200_sequencias.sql` — função `proxima_sequencia(nome)` (SECURITY DEFINER, mesmo contrato do `proximaSequencia()` do app) + seed das 10 sequências
   - `20261005120300_rls_e_privilegios.sql` — RLS **ligado em todas as tabelas** com policy temporária `using (true)` (**substituída pela Fase D** por policies por perfil); `auditoria` = SELECT+INSERT; `sequencias` = SELECT só (escrita só via RPC)
   - `20261006010000_emprestimos.sql` — tabela `emprestimos` da nova aba (FK p/ `ativos`, `previsao >= data`, `unique` de empréstimo em aberto por ativo, trigger de `atualizado_em`, sequência `EMP`, RLS ligado junto com a tabela)
   - `20261006020000_ativos_configuracao.sql` — coluna opcional `ativos.configuracao` (etiqueta/QR do equipamento)
3. ✅ Constraints: `UNIQUE(codigo)` (RN001, PK + regex `AAA-000`), unicidade de setor/fornecedor case-insensitive, FKs, `movimentacoes_rn006_setores_diferentes`, `quantidade >= 0`, `data_aquisicao NOT NULL`, coluna `atualizado_em` em toda tabela editável

**Como aplicar:** no SQL Editor do Supabase, colar os arquivos em ordem alfabética (ou `supabase db push` com a CLI). Validado em Postgres 17 real via Docker: todas as constraints, triggers, RLS e cascata passaram. **As 13 migrations já estão aplicadas no banco real** (8 da Fase A/B/C + as 2 da Fase D em 07/10 + as 2 de hardening do `anon` em 08/10 + o drop da coluna `token` em 08/10), com o histórico `supabase_migrations.schema_migrations` alinhado pela CLI (13/13) e `supabase db push` respondendo `upToDate: true`.

### Fase B — Camada de dados ✅ CONCLUÍDA (06/10/2026)
4. ✅ `src/data/api.ts` — `DEFINICOES` (14 coleções → tabela + PK + modo), mapeamento camel↔snake, `DD/MM/AAAA`↔`AAAA-MM-DD`, numeric→number, timestamptz→ISO; `carregarTudo()` (allSettled + sequências), `sincronizarColecao()` (diff por PK → upsert / `append` p/ LOG = **INSERT puro com 23505 tratado como "já existe"** desde `ff8c46c` — o upsert exigia SELECT da linha conflitante e negava o log de quem não lê auditoria / contagens com delete+insert de `contagem_itens`), `proximaSequenciaRemota()` (RPC)
5. ✅ **Os 11 stores não mudaram**: `src/data/repository.ts` manteve o contrato síncrono — grava o espelho na hora e dispara o sync em background (falha → toast de erro). Menos risco que refatorar stores.
6. ✅ Seed só no modo local — `bootstrap.iniciar()` virou assíncrono e o `main.tsx` monta o `App` só depois dele; no modo Supabase ele baixa as tabelas e **não** aplica seed (instância começa zerada, exceto os 4 usuários demo)
7. ✅ Recarregar ao voltar à aba/foco — **fechado em 13/10/2026** (`src/data/foco.ts`)

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
9. ✅ Cadastro de usuários por Admin (senha provisória → troca no 1º login) — `api/usuarios.mjs` (Vercel Function) + `src/data/admin.ts` + botões "Nova senha" e **"Excluir"** (conta Auth + cadastro, autoexclusão bloqueada no servidor); `usuarios.perfil` alimenta `permissions.ts`
10. ✅ Sessão persistida e sincronizada com `useAuthStore` — `persistSession`/`autoRefreshToken` + `restaurarSessao()` antes do boot renderizar

**Escopo extra que entrou:**
- ✅ `keepalive` nas escritas (risco adiado da Fase B) · ✅ **IDs de ATIVOS/estoque por sequência do servidor — fechados em 13/10/2026** (ver seção "Funcionalidade nova (13/10/2026)")
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
14. ✅ **Backups**: no free tier, dump agendado via GitHub Actions (semanal) — **obrigatório** (free não tem backup automático). **Consertado e validado em 13/10/2026**: dump pela Management API (PAT, sem senha do banco) + GPG AES-256 + round-trip obrigatório; **restore testado num Postgres 17 descartável** (16 tabelas, 5 contas auth com bcrypt). Artefato com retenção de 90 dias. Ver "Funcionalidade nova (13/10/2026)".
15. ✅ **Sentry (free) para erros** — **código pronto e validado em 14/10/2026**; ⚠️ **resta ~1 minuto seu**: criar a conta e colar o DSN. Camada em `src/data/erros.ts` (`iniciarErros` / `reportarErro` / `errosAtivos`) mais um `ErrorBoundary` em `src/components/ui/ErrorBoundary.tsx` — antes, um erro de render derrubava a árvore inteira e o usuário ficava numa **tela branca sem saída**; agora aparece "Recarregar" e o erro é reportado com a pilha de componentes.
    - **Só liga com `VITE_SENTRY_DSN`**; sem ela o comportamento é exatamente o antigo (console + aba Auditoria). Medido no build: **323 KB gz sem DSN** vs. 469 KB gz com (+145 KB do SDK, em chunk próprio).
    - ⚠️ **Ativação = colar a DSN + Redeploy.** O Vite embute a variável em tempo de build e, enquanto ela não existe, o `import('@sentry/react')` é removido por tree-shaking — ou seja, salvar a env var no Vercel **sozinha não faz nada** até o próximo deploy (mesma regra já documentada para as demais env vars).
    - **LGPD garantida por teste**: o `beforeSend` apaga `request` (URL, headers, cookies) e `user` (nome, e-mail) de **todo** evento, e não existe `setUser` em lugar nenhum do código — o sistema guarda nome, e-mail, setor e telefone de servidores.
    - Só exceções (`tracesSampleRate: 0`), e falha do SDK não derruba o boot.
16. ✅ **CI no GitHub Actions** (08/10/2026) — `.github/workflows/ci.yml`: em todo push na `main` e em todo PR roda `npm ci` → `oxlint --deny-warnings` → `tsc -b` → `vitest` → `build`, com cache de npm, Node 26 (mesma versão de dev), uma rodada por ref (a anterior é cancelada) e **sem segredos** (o build não exige as env vars do Supabase — sem elas o app cai no modo local). Primeira rodada: **verde em 35s** ([run 37826739284](https://github.com/wafeitoza/Sistema-de-T.I/actions/runs/37826739284)) + badge no README. **Gotcha:** o token do `gh` precisa do escopo **`workflow`** para push de arquivo em `.github/workflows/` (`gh auth refresh -s workflow`); sem ele o GitHub rejeita o push mesmo com `repo`.

### Fase F — Go-live
17. **Cadastrar usuários reais, treinar, definir RPO** — ⚠️ **precisa de você** (as pessoas e o treinamento não são automatizáveis). O banco está **zerado e pronto**: 0 ativos, 0 estoque, 26 sequências em 0 (o primeiro ativo real sai `NOTE-001`), 5 contas Auth com senha provisória.
18. ✅ **Domínio custom opcional** — **decidido em 13/10/2026: manter `it-stock-react.vercel.app` por ora.** Nome pretendido depois: **`itstock` + extensão** (`itstock.com.br`, **R$ 40/ano fixos no Registro.br**) — a **hospedagem no Vercel continua grátis** (até 50 domínios por projeto, TLS automático), mas o **nome nunca é de graça**. **Nenhuma mudança de código**: não há URL hardcoded em `src/`, `api/` ou `scripts/` (`montarLinkAprovacao` usa `window.location.origin` e `/api/usuarios` é same-origin), então apontar o domínio depois é só configuração na Vercel + DNS.
19. ✅ **Checklist**: ~~restore de backup testado~~ · ~~0 erros E2E~~ · ~~token Vercel revogado~~ · ~~demo separada/desativada~~ — **os 4 fechados em 13/10/2026**.
    - **Restore testado**: dump de 13/10 restaurado num Postgres 17 descartável (16 tabelas + dados + 5 contas auth com bcrypt).
    - **0 erros E2E**: 18/18 em produção, 0 erros de console, 0 respostas 4xx/5xx.
    - **Demo separada**: `aplicarSeed()` só roda quando `!modoSupabase` (`bootstrap.ts:22`); confirmado em produção — **sem cards de demonstração**, form de e-mail/senha.
    - **Token Vercel revogado**: conferido em 08/10/2026.

**Esforço estimado:** Fases B–D somam mais trabalho que as 6 fases anteriores juntas; validar com E2E a cada deploy (1 deploy por fase).

---

## 4. Convenções e quirks para retomar

### Stack e comandos
- Vite 8.3 · React 19 · TS ~6 · Tailwind 4 · React Router 7 · Zustand 5 · recharts · lucide-react · oxlint · Vitest 5
- `npm run lint` · `npx tsc -b` (o `tsc --noEmit` solto **não** checa o `tsconfig.app.json`) · `npm run build` · `npm test` · `npm run preview` (porta 4173)

### E2E (Chrome headless)
- CDP porta **9225** (`curl http://127.0.0.1:9225/json/list`) · target novo: `PUT /json/new?url` · WS global no Node 26 (sem biblioteca)
- Scripts em `/tmp/opencode/*.mjs` — hoje existem **`e2e-local.mjs` (13 checks, modo local)** e **`e2e-prod.mjs` (18 checks, produção com login real)**; os de produção de antes (`cdp-login.mjs` 21 · `cdp-etiquetas.mjs` 21 · `cdp-persistencia.mjs` 15 · `cdp-prod-supa*.mjs` 54) foram perdidos
- ⚠️ `/tmp` é limpo entre sessões — **os scripts precisam ser reescritos** quando isso acontece
- **Antes de rodar**: `pkill -f "remote-debugging-port=92[2]5"` em um comando **separado** (o colchete não é frescura: sem ele o `pkill -f` casa com o próprio comando e **mata o shell** — aconteceu de novo em 13/10, e **de novo no mesmo dia** quando o `pkill` e o `nohup` do Chrome foram colocados na mesma linha: o literal `9225` do `nohup` casava com o regex) — chrome órfão de execução anterior faz o script anexar no perfil velho (login já feito + dados editados = checks falsos)
- **Chrome**: o binário **não está no PATH** — usar `/opt/google/chrome/chrome --headless=new --no-sandbox --remote-debugging-port=9225 --user-data-dir=/tmp/opencode/chrome-perfil --window-size=1400,900 about:blank`
- **O perfil persiste entre execuções** → o script precisa `localStorage.clear()` + navegar de novo no início, senão o seed não renasce limpo e os códigos não batem
- **Validar deploy**: o index.html só cita o `index-*.js`, mas **o código do app está no chunk `App-*.js`** (o `main.tsx` importa o `App` dinamicamente). Conferir `grep '<string-distinta>' assets/App-*.js` — checar só o `index-*.js` dá falso negativo. **E o nome de função minificada NÃO serve de marcador** (`prepararBlocos` some do bundle): usar **hash MD5 do chunk**, que muda a cada deploy.
- **Quirks**: input React → setter nativo do prototype + `Event('input',{bubbles:true})`; select → setter de HTMLSelectElement + `Event('change')`; modal `[role=dialog]`; campos **não têm `name`/`id`** — só `placeholder`; codes de linha da tabela vêm com `\t` (`.trim()` senão o `.includes` falha); logout → botão `[aria-label="Sair"]`; `window.print()` é no-op no headless
- ⚠️ **Cuidado com o Chrome do desktop**: `pgrep/grep "9225"` casa com o renderer normal do seu Chrome (argumentos longos) — nunca matar sem confirmar que é o headless
- **Ruído aceito no login**: a tentativa de senha errada gera `400` em `/auth/v1/token` — o script filtra só esse caso e falha para qualquer outra 4xx/5xx

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

1. Abrir o projeto: `cd "/home/william/Projetos/Projetos AI/Sistema de T.I NTE/"`
2. `git status` + `git log --oneline -3` → deve estar limpo, topo `740d136` (fix das sequências) ou posterior
3. Conferir este arquivo (`PLANO-IMPLANTACAO.md`) e a seção 3
4. **Próximo passo (nesta ordem):**
   1. ✅ **14 migrations aplicadas no banco de produção** (a última, `20261013100000`, em 13/10/2026 via `supabase db push` → histórico `upToDate: true`) + **15 sequências conferidas no banco real** + **RLS do exterior 8/8** com a chave pública.
   2. ✅ **Deploy do frontend** (13/10/2026) — bundle no ar com as entregas; CI verde.
   3. ✅ **E2E de produção completo** (13/10/2026) — 18/18, 0 erros de console. Conta temporária via `node scripts/e2e-usuario.mjs criar|apagar` (service_role do `.env.local`).
   4. ✅ **Backup do banco consertado e restore testado** (13/10/2026) — ver "Funcionalidade nova (13/10/2026)".
   → ⚠️ **Resta da Fase E**: Sentry (item 15) — só falta a **conta + DSN** seus; o código está pronto e validado (14/10/2026). É a **única pendência da Fase E**.
   → ⚠️ **Resta da Fase F**: só o item 17 (usuários reais + treinamento + RPO) — sua ação. Item 18 (domínio) **decidido**: manter `it-stock-react.vercel.app` por ora, zero código. **O banco está zerado e pronto**: 0 ativos, 0 estoque, 26 sequências em 0 (o primeiro ativo real sai `NOTE-001`).
5. **Se mexer em migration**: aplicar no banco de produção ANTES do push — a Vercel deploya automático a cada push na `main` e um frontend novo com migration velha faria o app pedir sequência que o servidor não tem. Requer `supabase login` com PAT (**o atual `sbp_fc78582b…` é o secret do backup — não revogar**; se um dia revogar, trocar o secret também).
6. Rodar validação sempre: `npm run lint && npx tsc -b && npm test && npm run build`
7. E2E local sempre que mexer em login/dados: `npm run build` **sem `.env.local`** (para o modo local) + `npm run preview` (4173) + Chrome na 9225 + `node /tmp/opencode/e2e-local.mjs` (13 checks). Com env vars o mesmo build vira modo Supabase.
   - **E2E de produção**: `node scripts/e2e-usuario.mjs criar` → `node /tmp/opencode/e2e-prod.mjs` (18 checks, roda contra `it-stock-react.vercel.app` com Chrome na 9225) → `node scripts/e2e-usuario.mjs apagar`. Os dois scripts de `/tmp` precisam ser reescritos quando o `/tmp` zera.
8. Deploy: commit + push na `main` → Vercel auto-deploy (~12s) → validar hash + smoke E2E (**o código do app vive no chunk `App-*.js`**, não no `index-*.js` — `main.tsx` importa o `App` dinamicamente; checar só o index dá falso negativo)

### Pendências conhecidas
- ✅ ~~Aplicar as 2 migrations da Fase D no Supabase~~ — **feito em 07/10/2026** (banco conferido: 0 policies temporárias, `anon` sem acesso a tabela).
- ✅ ~~Remover a coluna `solicitacoes.token` (HMAC deprecada)~~ — **feito em 08/10/2026** (migration `20261008030000_remove_token_hmac.sql`; verificado antes que ninguém a lê — RPCs, tipo `Solicitacao`, mapeamento de colunas e suíte não a citam — Docker 81/81, produção 13/13, E2E aprovação 19/19).
- ✅ ~~**Revogar o PAT do Supabase** (`sbp_fc1a77d1…`)~~ — **feito em 08/10/2026** (revogado no dashboard; confirmado: `GET /v1/projects` → `401 Invalid access token`; `supabase logout` limpou o local). Próximas migrations exigem `supabase login` novo.
- ✅ ~~**Revogar o token da Vercel** (`vcp_8aAoy...`)~~ — **feito em 08/10/2026**: ausente da lista de tokens da conta e `Revoked` vazio, com confirmação do usuário; token de CLI antigo (`Vercel CLI on iMac…`, 08/08/2025) também eliminado na mesma conferência.
- ✅ ~~Env vars da Vercel + E2E de produção~~ — **feitos em 08/10/2026** (produção roda em modo Supabase; `/api/usuarios` responde 405/401/200 conforme o caso, nunca mais 500).
- ✅ **Ordem do deploy da Fase D**: migrations já estão no banco (07/10) — sobra só o deploy do frontend com as env vars.
- ✅ ~~IDs de `ATIVOS` e de itens de estoque calculados no cliente; recarregar ao voltar à aba/foco; conta Auth de usuário Inativo não é excluída~~ — **os três fechados em 13/10/2026**: sequência do servidor (migration `20261013100000` + fix do bloco, `740d136`), refetch no foco com debounce de 30 s (`src/data/foco.ts`) e exclusão de usuário pela UI com a ação `excluir` na API.
