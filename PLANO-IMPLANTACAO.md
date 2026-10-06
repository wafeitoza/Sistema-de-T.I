# PLANO DE IMPLANTAÇÃO E PONTO DE RETOMADA

> Documento de continuidade — **última atualização: 06/10/2026 (Fase A + B + C — login e sessão reais)**
> Leia este arquivo para continuar de onde paramos.

---

## 1. Estado atual do projeto

**Repo:** `https://github.com/wafeitoza/Sistema-de-T.I.git` (branch `main`)
**Produção:** https://it-stock-react.vercel.app (build `index-DCdSPWso.js`, modo localStorage)
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

### Qualidade (validado na última entrega)
- `npm run lint` → **0 warnings, 0 erros**
- `npx tsc --noEmit` → OK
- `npm test` → **132/132** (Vitest + happy-dom, 15 arquivos)
- `npm run build` → OK (`tsc -b` incluído)
- E2E Chrome headless: local e produção com **0 erros de console**
  (últimas rodadas: `cdp-etiquetas.mjs` 21 checks · `cdp-persistencia.mjs` 15 checks · **`cdp-login.mjs` 21 checks (Fase C, local)**)

### Estado do Git
`main` sincronizada com `origin/main`, topo `fdebae4` (**Fase C**).
Produção no build `index-DCdSPWso.js` (modo localStorage) — **as env vars da Vercel ainda não foram criadas**.

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

### Pendências / cuidados
- ⚠️ **Revogar o token da Vercel** (`vcp_8aAoy...`) usado nos deploys — trabalho da rodada terminou.
- ⚠️ **Criar as env vars na Vercel** (Settings → Environment Variables): `VITE_SUPABASE_URL` = `https://ftwaxhngujwswaauqfbn.supabase.co` · `VITE_SUPABASE_PUBLISHABLE_KEY` = `sb_publishable_DPdZU8GA-…` · `SUPABASE_URL` (mesma URL) · `SUPABASE_PUBLISHABLE_KEY` (mesma chave) · `SUPABASE_SERVICE_ROLE_KEY` = `sb_secret_…` (as 3 últimas **sem** prefixo `VITE_`, só para a Function). Sem elas o build segue em modo localStorage. **Depois de criar: Redeploy** — as variáveis entram só no build seguinte. → **em aberto, é o próximo passo**
- ⚠️ **E2E de produção ainda não rodou** (depende das env vars): login + `/api/usuarios` criar usuário → senha provisória → login dele → troca → redefinir → limpeza.
- ⚠️ IDs de `ATIVOS` (`NOTE-001`) e de itens de estoque (`Item-001`) ainda são calculados **no cliente** a partir do espelho — dois navegadores podem gerar o mesmo código e o upsert sobrescreve. As outras 11 coleções usam blocos de sequência do servidor. → **adiado para depois da Fase C**
- ⚠️ Recarregar dados ao voltar à aba/foco (item 7 da Fase B) — **ainda pendente**.
- ⚠️ Usuário **Inativo** perde o acesso no app, mas a conta Auth continua existindo (não há `excluir` na API) — fora do escopo desta rodada.
- Permissões vigentes em `src/lib/permissions.ts` (ACESSO_ROTA) — base para o RLS da Fase D.

---

## 2. Próximo grande objetivo: uso profissional

### Decisões já tomadas (com o usuário)
| Tema | Decisão |
|---|---|
| Backend | **Supabase** (recomendado; usuário pediu detalhe das 3 opções e aceitou seguir a recomendação) |
| Dados | **Começar do zero** (sem migrar demo), poucos usuários (2–10) |
| Orçamento | **Só plano grátis** (Vercel free + Supabase free tier) |
| Auth | **E-mail + senha** (sem MFA, sem login social) |

### O que ainda impede o uso profissional (pós-Fase C)
- **Produção segue em `localStorage`** (env vars da Vercel não criadas) → dados por navegador, não compartilhados
- Segredo HMAC `IT-STOCK-MVP-2026` hardcoded no bundle → links de aprovação forjáveis (**Fase D**)
- RLS com policy `using (true)` → qualquer cliente com a chave anon lê/escreve tudo (**Fase D**)
- `auditoria` aceita INSERT vindo do navegador sem autenticação (**Fase D**)
- Seed de demo continua rodando no modo local (sem env vars) — é proposital

**Já resolvido nas fases B e C:** dados no Supabase (modo dual), login e-mail+senha com sessão persistida e troca obrigatória de senha provisória, contas geridas por servidor (service_role fora do bundle), sequências em blocos no servidor, seed desligado no modo Supabase, `keepalive` nas escritas.

### Arquitetura atual (relevante para a migração)
- 11 stores Zustand **síncronos** usando `lerColecao`/`gravarColecao` de `src/data/repository.ts`:
  `ativos, auth, estoque, emprestimos, fornecedores, inventario, manutencao, movimentacoes, setores, solicitacoes, termos`
- `src/data/repository.ts` (48 linhas) foi desenhada para ser trocada por API — hoje já sincroniza em background (Fase B)
- `src/data/auth.ts` (sessão Supabase) e `src/data/admin.ts` (contas via Vercel Function) — Fase C
- `src/data/bootstrap.ts` executa `aplicarSeed()` antes dos stores carregarem (só no modo local)
- `src/lib/token.ts` — HMAC client-side (assinatura `${SEGREDO}|${texto}`)
- ~15 coleções: ATIVOS, ESTOQUE, SOLICITACOES, MANUTENCOES, CONTAGENS(+ITENS), TERMOS, SETORES, FORNECEDORES, MOVIMENTACOES, EMPRESTIMOS, USUARIOS, LOG, SEQ_*

---

## 3. Plano aprovado — Implantação profissional (Supabase free tier)

### Fase A — Fundação (1º deploy) ✅ CONCLUÍDA (05/10/2026)
1. ✅ Projeto Supabase criado (`ftwaxhngujwswaauqfbn`) com e-mail+senha habilitado
2. ✅ Schema SQL versionado em `supabase/migrations/` (6 iniciais + 2 das fases B/C = 8 arquivos, ordem alfabética = ordem de execução):
   - `20261005120000_esquema_inicial.sql` — 15 tabelas: `usuarios, setores, fornecedores, ativos, estoque, entradas_estoque, saidas_estoque, solicitacoes, manutencoes, contagens+contagem_itens, termos, movimentacoes, auditoria, sequencias`
   - `20261005120100_auditoria_append_only.sql` — trigger que bloqueia UPDATE/DELETE em `auditoria` (TRUNCATE liberado p/ restore) + trigger de `atualizado_em` em 10 tabelas
   - `20261005120200_sequencias.sql` — função `proxima_sequencia(nome)` (SECURITY DEFINER, mesmo contrato do `proximaSequencia()` do app) + seed das 10 sequências
   - `20261005120300_rls_e_privilegios.sql` — RLS **ligado em todas as tabelas** com policy temporária `using (true)` (Fase D substitui por perfil); `auditoria` = SELECT+INSERT; `sequencias` = SELECT só (escrita só via RPC)
   - `20261006010000_emprestimos.sql` — tabela `emprestimos` da nova aba (FK p/ `ativos`, `previsao >= data`, `unique` de empréstimo em aberto por ativo, trigger de `atualizado_em`, sequência `EMP`, RLS ligado junto com a tabela)
   - `20261006020000_ativos_configuracao.sql` — coluna opcional `ativos.configuracao` (etiqueta/QR do equipamento)
3. ✅ Constraints: `UNIQUE(codigo)` (RN001, PK + regex `AAA-000`), unicidade de setor/fornecedor case-insensitive, FKs, `movimentacoes_rn006_setores_diferentes`, `quantidade >= 0`, `data_aquisicao NOT NULL`, coluna `atualizado_em` em toda tabela editável

**Como aplicar:** no SQL Editor do Supabase, colar os arquivos em ordem alfabética (ou `supabase db push` com a CLI). Validado em Postgres 17 real via Docker: todas as constraints, triggers, RLS e cascata passaram. **As 8 migrations já estão aplicadas no banco real.**

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

### Fase D — Segurança server-side
11. Aprovação por link (RN004): trocar HMAC client-side por **UUID aleatório no banco** (`aprovacao_token` em `solicitacoes`) — sem segredo no bundle
12. **RLS em todas as tabelas** espelhando `permissions.ts` (Admin/Gerente/Técnico/Viewer)
13. Validações críticas no banco (unicidade RN001, RN006)

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
- `npm run lint` · `npx tsc --noEmit` · `npm run build` · `npm test` · `npm run preview` (porta 4173)

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
4. **Próximo passo:** você cria na Vercel as 5 env vars (3 do frontend + 3 da Function, ver Pendências) e clica **Redeploy**
   → eu valido o E2E de produção: hash do bundle · login com senha provisória · troca · `/api/usuarios` (criar usuário → senha provisória → login dele → troca → redefinir) → limpeza
   → **Fase D** (aprovação por UUID no banco + RLS por perfil + validações críticas)
5. Rodar validação sempre: `npm run lint && npx tsc --noEmit && npm test && npm run build`
6. E2E local sempre que mexer em login/dados: `npm run build` + `npm run preview` (4173) + Chrome na 9225 + `node /tmp/opencode/cdp-login.mjs "<provisória>"`
7. Deploy: commit + push na `main` → Vercel auto-deploy (~12s) → validar hash + smoke E2E
8. Ao final: revogar token da Vercel

### Pendências conhecidas
- ⚠️ **Revogar o token da Vercel** (`vcp_8aAoy...`) usado nos deploys.
- ⚠️ **Env vars da Vercel + E2E de produção** — enquanto não existir, produção roda em localStorage e `/api/usuarios` responde 500.
- ⚠️ RLS está com policy temporária `using (true)` (acesso geral) — **obrigatório resolver na Fase D** antes de dados reais.
- ⚠️ `auditoria` hoje aceita INSERT vindo do navegador (sem autenticação) — **resolver na Fase D** (a Fase C autentica o app, mas não o RLS).
- ⚠️ IDs de `ATIVOS` e de itens de estoque calculados no cliente; recarregar ao voltar à aba/foco; conta Auth de usuário Inativo não é excluída — pós-Fase C.
