# Integração Gmail → Chamados — estado final e operação (19/10/2026)

> Documento de operação da integração, versionado no repo. Atualizado em 19/10/2026.

## Como funciona

- E-mails do GLPI chegam **de** `centraldeservicos@educacao.ba.gov.br`
  **na caixa** `william.feitoza@enova.educacao.ba.gov.br` (a que se conecta).
- Filtro na tela: `from:centraldeservicos@educacao.ba.gov.br newer_than:7d`
  (só isso vira chamado; o resto da caixa não entra na fila).
- `.github/workflows/chamados-sync.yml` chama `GET /api/cron-sincronizar`
  a cada 5 min com `Bearer $CRON_SECRET` → mesma lógica de "Sincronizar agora"
  (`api/_gmail.mjs`). Repo público ⇒ Actions agendado é grátis.
- Primeira sincronização real: **9 chamados GLPI + 22 mensagens** (19/10).

## Checklist final ✅

- [x] Migrations `chamados`/`integracoes` aplicadas em produção
      (nunca tinham rodado — erro PGRST205) via **`.github/workflows/db-migrate.yml`**
      (`gh workflow run db-migrate.yml -f confirmar=producao`) +
      `scripts/aplicar-migrations.sh` (PAT `SUPABASE_ACCESS_TOKEN`, sem senha de banco)
- [x] App Google: **Externo + Testando** (era Interno → `org_internal` bloqueava)
      + test user **`william.feitoza@enova.educacao.ba.gov.br`**
- [x] Caixa conectada; `integracoes.conta` grava a **caixa real** (users/me/profile)
- [x] Filtro correto; `prompt=consent` garante refresh token a cada reconexão
- [x] Bug do `geradorIds` corrigido (`CHM-2026-000000` → bloco reservado no 1º uso;
      chamado renomeado por delete+reimport → `CHM-2026-000201`)
- [x] Workflow de 5 min **reativado** e verde com sync real
      (`HTTP 200 — sincronização processada`, dedupe `chamadosCriados:0`)

## Operação

### Reconexão (~7 dias — app em teste)

1. `/chamados` → **Conectar Gmail** → entrar como `william.feitoza@enova…` → Permitir
   (`prompt=consent` garante refresh token novo). Se o sistema avisar
   "A autorização do Gmail expirou", é só refazer.
2. Test user já está no Console (Auth → Público-alvo); não precisa mexer.

### Migrations futuras

`gh workflow run db-migrate.yml -f confirmar=producao` (input opcional
`migrations` = lista de arquivos; vazio = todas as pendentes). O histórico vem
de `supabase_migrations.schema_migrations` (coluna `version` = só os 14 dígitos).

### Verificação rápida

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  https://it-stock-react.vercel.app/api/cron-sincronizar
# ok: {"chamadosCriados":N,…,"origem":"cron"} HTTP 200
```

## Gotchas / observações

- **7 dias**: app em status "Testando" (só test users). Publicar em produção
  eliminaria o limite (exige homepage/política de privacidade no Branding).
- Filtro `newer_than:7d` + `maxResults=50` **sem paginação**: e-mail com mais de
  7 dias (ou além dos 50 da janela) não entra.
- `CRON_SECRET` idêntico no GitHub e na Vercel (`2ca80478…ed26d3`). No log do
  workflow, "HTTP 401/500" que aparecem são o **texto ecoado do script**, não
  resposta real — olhe a linha do corpo JSON.
- Workflows agendados de repo público desativam após **60 dias sem commits**.
- `auditar()` **engole erro** (só `console.error`): o save de filtro da tela às
  17:34 sem linha na auditoria sugere INSERT de log falhando às vezes — se notar
  buraco na trilha de auditoria, é por lá (logs da Vercel só expõem requests,
  não o stdout — ver no dashboard).
- Numeração pula blocos de 50 (`sequencias`) — buracos (101–150, 159–200) são
  normais, é o app e o server consumindo blocos separados.
