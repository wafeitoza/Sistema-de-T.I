# IT Stock & Inventory — React

[![CI](https://github.com/wafeitoza/Sistema-de-T.I/actions/workflows/ci.yml/badge.svg)](https://github.com/wafeitoza/Sistema-de-T.I/actions/workflows/ci.yml)

Sistema de gestão de T.I. (ativos, estoque, inventário, solicitações, manutenção, termos de responsabilidade, setores, fornecedores e movimentações) em React, baseado na especificação `IT-Stock-Specs/SISTEMA-IT-STOCK.md`.

Produção: **https://it-stock-react.vercel.app**

## Stack

- Vite 8 + React 19 + TypeScript 6
- Tailwind CSS 4 (tema claro/escuro)
- React Router 7 · Zustand 5 · Recharts · lucide-react
- Testes: Vitest + happy-dom · Lint: oxlint
- Persistência: **modo duplo** — `localStorage` (padrão, sem env) ou **Supabase**
  quando `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` existem
  (camada de repositório em `src/data/repository.ts`)
- Auth (modo Supabase): e-mail + senha via Supabase Auth, contas **criadas,
  redefinidas e excluídas** pela Vercel Function `api/usuarios.mjs`
  (service_role fica só no servidor; só Admin/Ativo é aceito)

## Rodar localmente

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc + vite build -> dist/
npm run preview  # serve dist/ em http://localhost:4173
npm run lint     # oxlint (0 warnings)
npm test         # vitest run (unitários das libs puras)
```

## Login

**Modo Supabase** (com as env vars ligadas): formulário de e-mail + senha. As
contas são criadas pelo Admin em `/usuarios` — o sistema gera uma **senha
provisória** mostrada uma única vez e **obriga a troca no primeiro login**.
Para zerar as senhas de teste:

```bash
SUPABASE_SERVICE_ROLE_KEY=sb_secret_... node scripts/gerar-senhas.mjs
```

**Modo local** (sem env vars, seed de demonstração): login por card de perfil,
sem senha.

| Perfil | E-mail | Acesso |
|---|---|---|
| Admin | admin@empresa.com | tudo (inclui usuários e configurações) |
| Admin | william@empresa.com | tudo (inclui usuários e configurações) |
| Gerente | gerente@empresa.com | relatórios, solicitações, auditoria, cadastros |
| Técnico | tecnico@empresa.com | ativos, estoque, inventário, movimentações, manutenção |
| Visualizador | viewer@empresa.com | somente leitura (relatórios permitidos) |

Para re-rodar o seed em testes, limpe `ITSTOCK_SESSAO` (ou todo o `localStorage`).

## Funcionalidades por fase

1. **Auditoria + Configurações** — `/auditoria` com filtros, diff expansível e export CSV; `/config` com tema, estatísticas, export/import de backup e restaurar demo.
2. **Notificações + busca + ordenação** — sino com pendências (solicitações, manutenções, estoque, contagens), busca global `Ctrl+K` e ordenação com paginação em todas as tabelas.
3. **Relatórios** — 6 gráficos Recharts (status, setor, aquisições, manutenções, movimentações, categorias), filtros por período/setor, export CSV e impressão/PDF (`@media print`).
4. **Termos de responsabilidade + etiquetas** — termos com hash SHA-256 (criar, assinar, revogar, revalidar e detectar adulteração) e etiquetas de ativos com QR Code para impressão (10 por folha A4).
5. **Setores, fornecedores e movimentações** — cadastros completos com status, migração do seed legado e movimentação de ativos entre setores com confirmação/cancelamento (RN006).
6. **Qualidade** — Vitest (164 testes unitários), lint a 0 warnings, remoção de código morto e badge "Em andamento" para contagens.
7. **Supabase (fases A–D)** — schema SQL versionado em `supabase/migrations/`, camada de dados dual, **login real** por e-mail + senha com sessão persistida e **segurança server-side** (RLS por perfil, `anon` sem acesso a tabelas, aprovação por link com UUID no banco — testado em `supabase/tests/rls_fase_d.sql`).
8. **Fechamento das pendências da Fase C** — **códigos de ativo e de item de estoque saem de bloco de sequência do servidor** (dois navegadores não geram mais o mesmo `NOTE-001`; `20261013100000_sequencias_ativos_estoque.sql` semeia as 14 sequências `ATV_<prefixo>` + `ITEM` no maior código existente) e **dados recarregam sozinhos ao voltar para a aba** (`src/data/foco.ts`, debounce de 30 s, só com sessão).
9. **Operação (fases E–F)** — **backup semanal do banco** via GitHub Actions (`scripts/backup-postgres.sh`: dump pela Management API com PAT ou por `SUPABASE_DB_URL`, criptografia GPG AES-256 e **round-trip obrigatório**; restore testado num Postgres descartável) + **E2E de produção** com login real (`scripts/e2e-usuario.mjs` cria/apaga a conta temporária).

## Estrutura

```
src/
├── types/        modelos (Ativo, Estoque, Solicitação, Manutenção, Termo, Setor…)
├── data/         seed demo + repositório dual (localStorage/Supabase) + bootstrap
│                 api.ts (sync), auth.ts (sessão), admin.ts (contas), client.ts
├── lib/          regras: códigos, validação, permissões, auditoria, termos/hash,
│                 backup, notificações, formatação, tabela (ordenação/paginação)
├── store/        Zustand: auth, ativos, estoque, solicitacoes, manutencao,
│                 inventario, termos, setores, fornecedores, movimentacoes, ui
├── components/   layout (sidebar agrupada, header, sino, busca Ctrl+K) + kit de UI
├── assets/       imagens importadas pelo bundle (com hash no nome — logo do sistema)
└── pages/        login, dashboard, ativos, estoque, inventário, solicitações,
                  manutenção, relatórios, termos, setores, fornecedores,
                  movimentações, usuários, auditoria, configurações
api/              Vercel Function (gestão de contas com service_role)
scripts/          utilitários de operação (gerar-senhas.mjs, e2e-usuario.mjs,
                 backup-postgres.sh — este roda no GitHub Actions semanal)
supabase/         migrations SQL (schema, RLS, sequências, auth_id)
```

## Regras de negócio

- **RN001** código único de ativo (`NOTE-001`, `MON-001`…) via prefixos + sequência
- **RN002** máquina de status do ativo (descarte = irreversível)
- **RN003** alerta de baixo estoque (badge + dashboard)
- **RN004** aprovação por link assinado (`/aprovacao/:token`, expira em 7 dias)
- **RN005** termos com hash SHA-256; adulteração detectada na revalidação
- **RN006** movimentação de ativo entre setores com confirmação explícita
- **RN007** manutenção: próxima preventiva = conclusão + 90 dias, alerta ≤ 5 dias
- **RN009** auditoria: log + diff de cada operação (todas as tabelas)
- **RN010** inventário: contagem física com divergências e ajuste automático de saldo
- Perfis de acesso com controle de rotas e ações (`src/lib/permissions.ts`)

## Datas

Campos editáveis usam `DD/MM/YYYY` (`dataAquisicao`, entradas/saídas, manutenções, contagens); datas de sistema (`criadoEm`, `dataHora`) ficam em ISO. Utilitários em `src/lib/format.ts`.

## Deploy na Vercel

- Framework: **Vite** (auto-detectado) · Build: `npm run build` · Output: `dist`
- `vercel.json` inclui rewrite SPA — necessário para rotas profundas como `/aprovacao/:token`
  (o filesystem — incluindo `api/` — tem precedência sobre o rewrite, então
  `/api/usuarios` continua chegando na Function)
- Push na branch `main` dispara deploy automático

**Variáveis de ambiente** (Settings → Environment Variables) — sem elas o build
sai em modo `localStorage`:

| Variável | Uso |
|---|---|
| `VITE_SUPABASE_URL` | frontend |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | frontend (chave pública) |
| `VITE_SENTRY_DSN` | frontend — **opcional**; sem ela não há Sentry |
| `SUPABASE_URL` | Function `api/usuarios.mjs` |
| `SUPABASE_PUBLISHABLE_KEY` | Function |
| `SUPABASE_SERVICE_ROLE_KEY` | Function — **nunca** no frontend |
| `GOOGLE_CLIENT_ID` | Function — app OAuth do Gmail (chamados) |
| `GOOGLE_CLIENT_SECRET` | Function — idem |
| `GOOGLE_REDIRECT_URI` | Function — URI fixa registrada no Google |
| `INTEGRACAO_CHAVE` | Function — cifra o refresh token (≥32 caracteres) |
| `CRON_SECRET` | Function — segredo do cron `/api/cron-sincronizar` |

**Sincronização automática de chamados** — o `vercel.json` registra um cron
(`*/5 * * * *`) que chama `GET /api/cron-sincronizar`. A Vercel envia
`Authorization: Bearer ${CRON_SECRET}` automaticamente em toda invocação de
cron: sem a env var `CRON_SECRET` definida, o endpoint recusa tudo. No plano
**Hobby** o Vercel Cron roda no máximo 1x/dia — nos planos Pro, a cada 5
minutos. Enquanto a caixa não for conectada pela tela de Chamados, o cron
apenas avisa no log e não importa nada.

Depois de criar/editar env vars é preciso um **Redeploy** (entram só no build seguinte).

```bash
# via CLI
npm i -g vercel && vercel
```
