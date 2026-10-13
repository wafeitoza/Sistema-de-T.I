#!/usr/bin/env bash
#
# Backup do banco de produção — Fase E, item 14 do PLANO-IMPLANTACAO.md.
# (O free tier do Supabase não tem backup automático; sem isto aqui não há
# como recuperar dados apagados por engano.)
#
# Rodo no GitHub Actions (semanal, .github/workflows/backup.yml) e localmente.
# DOIS caminhos, na ordem de preferência:
#
#   1. SUPABASE_DB_URL (connection string) → pg_dump direto, o mais completo.
#      Não testa alcance de rede nem senha: falha alto e cedo.
#
#       SUPABASE_DB_URL='postgres://postgres.<ref>:<senha>@.../postgres' \
#       BACKUP_PASSPHRASE='...' bash scripts/backup-postgres.sh
#
#   2. SUPABASE_ACCESS_TOKEN (PAT) + SUPABASE_PROJECT_REF → `supabase db dump`,
#      que passa pela Management API e por isso **não precisa da senha do
#      banco**. É o caminho do Actions hoje: em 12/10/2026 a rodada agendada
#      falhou em 15s porque o secret SUPABASE_DB_URL nunca tinha sido criado,
#      e a senha do banco não estava à mão. Um PAT resolve sem ela.
#
#       SUPABASE_ACCESS_TOKEN='sbp_...' SUPABASE_PROJECT_REF='ftwax...' \
#       BACKUP_PASSPHRASE='...' bash scripts/backup-postgres.sh
#
#       Gotcha do caminho 2: `supabase db dump` SEM flag devolve SÓ o schema
#       (16 CREATE TABLE, 0 INSERT) — backup de verdade é schema + --data-only
#       concatenados, nesta ordem. E ele puxa uma imagem postgres pra rodar o
#       pg_dump, então precisa de docker disponível.
#
# O dump sai CRIPTOGRAFADO (GPG simétrico AES-256): o repositório é público e
# artefato do Actions não é lugar seguro para dado cru (inclui auth.users).
#
# Restaurar:
#   gpg -d backup-AAAA-MM-DD.sql.gz.gpg | gunzip | psql "$SUPABASE_DB_URL"
#
# Requisitos: docker (+ supabase CLI no caminho 2).
set -euo pipefail

: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE não definido — é o secret do GitHub}"

SAIDA="backup-$(date -u +%F).sql.gz.gpg"
TRABALHO="$(mktemp -d)"
trap 'rm -rf "$TRABALHO"' EXIT

gerar_dump() {
  # escreve em $1 o SQL cru (schema + dados, nessa ordem)
  local destino="$1"

  if [ -n "${SUPABASE_DB_URL:-}" ]; then
    # pg_dump precisa ser MAIOR OU IGUAL à versão do servidor (regra do
    # PostgreSQL). postgres:18 cobre servidores 17 e 18; suba PG_IMAGE se o
    # Supabase subir de major (o script confere e barra antes de dumpar).
    local pg_image="${PG_IMAGE:-postgres:18-alpine}"
    local alvo_seguro
    alvo_seguro() { printf '%s' "$1" | sed -E 's#^([^:]+://[^:/@]+):[^@]*@#\1:***@#'; }
    echo "→ caminho: pg_dump direto (SUPABASE_DB_URL)"
    echo "→ alvo:    $(alvo_seguro "$SUPABASE_DB_URL")"
    echo "→ imagem:  $pg_image"

    local servidor major_servidor major_dump
    servidor="$(docker run --rm "$pg_image" psql "$SUPABASE_DB_URL" -tAc 'show server_version' | tr -d '[:space:]')"
    major_servidor="${servidor%%[!0-9]*}"
    major_dump="${pg_image#*:}"
    major_dump="${major_dump%%[!0-9]*}"
    echo "→ servidor: PostgreSQL $servidor"
    if [ "$major_dump" -lt "$major_servidor" ]; then
      echo "✗ pg_dump $major_dump < servidor $servidor — defina PG_IMAGE maior" >&2
      return 1
    fi

    # --exclude-schema=extensions é de propósito: são DDLs declarativas
    # (CREATE EXTENSION), já presentes num projeto Supabase novo, e são a
    # maior fonte de erro em restore. Dado vivo (public/auth/storage/vault) entra tudo.
    docker run --rm "$pg_image" pg_dump \
      --no-owner --no-privileges --exclude-schema=extensions \
      --dbname="$SUPABASE_DB_URL" >"$destino"
    return 0
  fi

  if [ -n "${SUPABASE_ACCESS_TOKEN:-}" ] && [ -n "${SUPABASE_PROJECT_REF:-}" ]; then
    command -v supabase >/dev/null || {
      echo "✗ caminho 2 precisa do CLI: npm i -g supabase" >&2
      return 1
    }
    echo "→ caminho: supabase db dump (PAT, Management API — sem senha do banco)"
    echo "→ projeto: $SUPABASE_PROJECT_REF"

    # schema primeiro, dados depois: um restore lê nessa ordem
    supabase db dump --project-ref "$SUPABASE_PROJECT_REF" \
      --file "$TRABALHO/schema.sql" >/dev/null
    supabase db dump --project-ref "$SUPABASE_PROJECT_REF" --data-only \
      --file "$TRABALHO/dados.sql" >/dev/null

    local tabelas inserts
    tabelas="$(grep -c '^CREATE TABLE' "$TRABALHO/schema.sql" || true)"
    inserts="$(grep -c '^INSERT INTO' "$TRABALHO/dados.sql" || true)"
    echo "→ schema: $tabelas tabelas · dados: $inserts statements"
    if [ "$tabelas" -lt 1 ]; then
      echo "✗ dump de schema veio vazio — abortando" >&2
      return 1
    fi

    cat "$TRABALHO/schema.sql" "$TRABALHO/dados.sql" >"$destino"
    return 0
  fi

  {
    echo "✗ nenhum caminho de backup disponível."
    echo "  Defina SUPABASE_DB_URL (connection string, preferido) ou"
    echo "  SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF (PAT, sem senha do banco)."
  } >&2
  return 1
}

gerar_dump "$TRABALHO/dump.sql"

[ -s "$TRABALHO/dump.sql" ] || { echo "✗ dump vazio" >&2; exit 1; }

# criptografa (nunca deixar SQL cru em disco de runner nem no artefato)
gzip -9 -c "$TRABALHO/dump.sql" |
  gpg --batch --yes --symmetric --cipher-algo AES256 \
    --output "$SAIDA" --passphrase-fd 3 \
    3<<<"$BACKUP_PASSPHRASE"

# round-trip obrigatório: se o dump não abrir/descomprimir, o backup é lixo
# e o workflow tem que falhar agora, não numa restauração de emergência.
gpg --batch --quiet --passphrase-fd 3 -d "$SAIDA" 3<<<"$BACKUP_PASSPHRASE" |
  gzip -t

TAMANHO="$(du -h "$SAIDA" | cut -f1)"
LINHAS="$(zcat < <(gpg --batch --quiet --passphrase-fd 3 -d "$SAIDA" 3<<<"$BACKUP_PASSPHRASE") | wc -l)"
echo "✓ $SAIDA — $TAMANHO · $LINHAS linhas SQL · gzip + AES-256 · round-trip OK"

if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "### Backup do banco — $(date -u +%F)"
    echo ""
    echo "- arquivo: \`$SAIDA\` ($TAMANHO, $LINHAS linhas SQL)"
    echo "- gzip · AES-256 (GPG) · round-trip (decripta + descomprime) verificado"
    echo "- restaurar: \`gpg -d $SAIDA | gunzip | psql \"\$SUPABASE_DB_URL\"\`"
  } >>"$GITHUB_STEP_SUMMARY"
fi
