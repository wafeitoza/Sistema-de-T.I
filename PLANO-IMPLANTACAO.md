# PLANO DE IMPLANTAÇÃO E PONTO DE RETOMADA

> Documento de continuidade — **última atualização: 06/10/2026 (Fase A + aba Empréstimos + etiquetas/QR + Fase B)**
> Leia este arquivo para continuar de onde paramos.

---

## 1. Estado atual do projeto

**Repo:** `https://github.com/wafeitoza/Sistema-de-T.I.git` (branch `main`)
**Produção:** https://it-stock-react.vercel.app (build `index-B1zA1uqh.js`)
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

### Qualidade (validado na última entrega)
- `npm run lint` → **0 warnings, 0 erros**
- `npx tsc --noEmit` → OK
- `npm test` → **92/92** (Vitest + happy-dom, 12 arquivos)
- `npm run build` → OK (`tsc -b` incluído)
- E2E Chrome headless: local e produção com **0 erros de console**
  (últimas rodadas: `cdp-etiquetas.mjs` 21 checks (local) · **`cdp-persistencia.mjs` 15 checks (Supabase)**)

### Estado do Git
`main` sincronizada com `origin/main`, topo `de1d1e3`. **Fase B ainda NÃO commitada** (aguardando seu OK).
Produção segue no build `index-B1zA1uqh.js` (modo localStorage — as env vars da Vercel ainda não foram criadas).

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

### Pendências / cuidados
- ⚠️ **Revogar o token da Vercel** (`vcp_8aAoy...`) usado nos deploys — trabalho da rodada terminou.
- ⚠️ **Criar as env vars na Vercel** (Settings → Environment Variables): `VITE_SUPABASE_URL` = `https://ftwaxhngujwswaauqfbn.supabase.co` e `VITE_SUPABASE_PUBLISHABLE_KEY` = `sb_publishable_DPdZU8GA-...` (publishable, **não** a service_role). Sem elas o build segue em modo localStorage. **Depois de criar, é preciso um redeploy** (botão *Redeploy* na Vercel ou um novo push) — as variáveis entram só no build seguinte.
- ⚠️ Sync é *fire-and-forget*: um F5 nos ~200 ms seguintes a uma escrita pode perdê-la (candidato: `keepalive` no fetch). → **decisão do usuário: adiar para a Fase C**
- ⚠️ IDs de `ATIVOS` (`NOTE-001`) e de itens de estoque (`Item-001`) ainda são calculados **no cliente** a partir do espelho — dois navegadores podem gerar o mesmo código e o upsert sobrescreve. As outras 11 coleções já usam blocos de sequência do servidor. → **decisão do usuário: adiar para a Fase C**
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

### Por que não está pronto hoje
- Dados em `localStorage` → **por navegador, não compartilhados entre usuários**
- Login por card **sem senha** (basta saber o e-mail)
- Segredo HMAC `IT-STOCK-MVP-2026` hardcoded no bundle → links de aprovação forjáveis
- `src/data/bootstrap.ts` roda **seed de demo** em todo primeiro acesso
- Sequências e logs de auditoria também no navegador

### Arquitetura atual (relevante para a migração)
- 11 stores Zustand **síncronos** usando `lerColecao`/`gravarColecao` de `src/data/repository.ts`:
  `ativos, auth, estoque, emprestimos, fornecedores, inventario, manutencao, movimentacoes, setores, solicitacoes, termos`
- `src/data/repository.ts` (48 linhas) foi desenhado para ser trocado por API
- `src/data/bootstrap.ts` executa `aplicarSeed()` antes dos stores carregarem
- `src/lib/token.ts` — HMAC client-side (assinatura `${SEGREDO}|${texto}`)
- ~15 coleções: ATIVOS, ESTOQUE, SOLICITACOES, MANUTENCOES, CONTAGENS(+ITENS), TERMOS, SETORES, FORNECEDORES, MOVIMENTACOES, EMPRESTIMOS, USUARIOS, LOG, SEQ_*

---

## 3. Plano aprovado — Implantação profissional (Supabase free tier)

### Fase A — Fundação (1º deploy) ✅ CONCLUÍDA (05/10/2026)
1. ~~Criar projeto Supabase (grátis, 2 projetos, 500 MB, 50k MAU) + habilitar e-mail/senha~~ → **falta só sua parte: criar a conta e o projeto**
2. ✅ Schema SQL versionado em `supabase/migrations/` (6 arquivos, ordem alfabética = ordem de execução):
   - `20261005120000_esquema_inicial.sql` — 15 tabelas: `usuarios, setores, fornecedores, ativos, estoque, entradas_estoque, saidas_estoque, solicitacoes, manutencoes, contagens+contagem_itens, termos, movimentacoes, auditoria, sequencias`
   - `20261005120100_auditoria_append_only.sql` — trigger que bloqueia UPDATE/DELETE em `auditoria` (TRUNCATE liberado p/ restore) + trigger de `atualizado_em` em 10 tabelas
   - `20261005120200_sequencias.sql` — função `proxima_sequencia(nome)` (SECURITY DEFINER, mesmo contrato do `proximaSequencia()` do app) + seed das 10 sequências
   - `20261005120300_rls_e_privilegios.sql` — RLS **ligado em todas as tabelas** com policy temporária `using (true)` (Fase D substitui por perfil); `auditoria` = SELECT+INSERT; `sequencias` = SELECT só (escrita só via RPC)
   - `20261006010000_emprestimos.sql` — tabela `emprestimos` da nova aba (FK p/ `ativos`, `previsao >= data`, `unique` de empréstimo em aberto por ativo, trigger de `atualizado_em`, sequência `EMP`, RLS ligado junto com a tabela)
   - `20261006020000_ativos_configuracao.sql` — coluna opcional `ativos.configuracao` (etiqueta/QR do equipamento)
3. ✅ Constraints: `UNIQUE(codigo)` (RN001, PK + regex `AAA-000`), unicidade de setor/fornecedor case-insensitive, FKs, `movimentacoes_rn006_setores_diferentes`, `quantidade >= 0`, `data_aquisicao NOT NULL`, coluna `atualizado_em` em toda tabela editável

**Como aplicar:** no SQL Editor do Supabase, colar os 6 arquivos em ordem (ou `supabase db push` com a CLI). Validado em Postgres 17 real via Docker: todas as constraints, triggers, RLS e cascata passaram.

**Ainda não feito da Fase A:** criar a conta/projeto Supabase (requer você) e me passar URL + anon key.

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

### Fase C — Login e sessão reais
8. Login e-mail+senha (Supabase Auth); remover login por card em produção (manter só em dev)
9. Cadastro de usuários por Admin (senha provisória → troca no 1º login); tabela `usuarios` com perfil que alimenta `permissions.ts`
10. Sessão persistida e sincronizada com `useAuthStore`

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
- Scripts em `/tmp/opencode/cdp-*.mjs` (ex.: `cdp-etiquetas.mjs` 21 checks · `cdp-persistencia.mjs` 15 checks p/ modo Supabase)
- **Antes de rodar**: `pkill -f "remote-debugging-port=92[2]5"` — chrome órfão de execução anterior faz o script anexar no perfil velho (login já feito + dados editados = checks falsos)
- **Quirks**: input React → setter nativo do prototype + `Event('input',{bubbles:true})`; select → setter de HTMLSelectElement + `Event('change')`; screenshot → repaint zoom 1.01/1.0 + `bringToFront`; modal `[role=dialog]`; leitura de imagem stale → contornar com `magick <file> -crop WxH+X+Y` antes do Read; `window.print()` é no-op no headless
- Validar deploy: hash de `dist/assets/index-*.js` == `<script>` de `https://it-stock-react.vercel.app/`

### Datas e segurança
- Campos editáveis em `DD/MM/YYYY`; `criadoEm`/`dataHora` ISO; usar `formatarData`/`diasAte`/`dataBRparaDate` (`src/lib/format.ts`)
- `localStorage` prefixo `ITSTOCK_*`; guard `ITSTOCK_SEEDED`; sessão `ITSTOCK_SESSAO`
- Login demo: `admin@/gerente@/tecnico@/viewer@empresa.com` (cards)

### Padrões de código adotados
- Anti-warning de estado na renderização: `const [abertoAnterior, setAbertoAnterior] = useState(aberto); if (aberto !== abertoAnterior) { setAbertoAnterior(aberto); if (aberto) {...sets} }` — usado em todos os modais de form
- Tom de badge extraído em `src/components/ui/tom.ts` (`tomDoStatus`, `MAPA_STATUS`)
- Baseline de lint: **0 warnings** — manter assim

---

## 5. Como retomar (checklist)

1. Abrir o projeto: `cd /home/williamfeitoza/IT-Stock-Global/Projects/it-stock-react/`
2. `git status` + `git log --oneline -3` → deve estar limpo, topo `de1d1e3` (ou posterior)
3. Conferir este arquivo (`PLANO-IMPLANTACAO.md`) e a seção 3
4. **Próximo passo:** Fase B está pronta mas **não commitada** → me dá o OK para commit/push
   → e cria na Vercel as env vars `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`
   (depois disso: *Redeploy* para o build pegar as variáveis) → eu valido o E2E de produção em modo Supabase
   → **Fase C** (login e-mail+senha) e nela os 2 riscos adiados (keepalive + IDs por sequência)
5. Rodar validação sempre: `npm run lint && npx tsc --noEmit && npm test && npm run build`
6. Deploy: commit + push na `main` → Vercel auto-deploy (~12s) → validar hash + smoke E2E
   (rebuild obrigatório antes do E2E: `npm run build` e `npm run preview` na 4173)
7. Ao final: revogar token da Vercel

### Pendências conhecidas
- ⚠️ **Revogar o token da Vercel** (`vcp_8aAoy...`) usado nos deploys.
- ⚠️ RLS está com policy temporária `using (true)` (acesso geral) — **obrigatório resolver na Fase D** antes de dados reais.
- ⚠️ `auditoria` hoje aceita INSERT vindo do navegador (sem autenticação) — aceitável só até a Fase C.
