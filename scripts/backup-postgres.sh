#!/usr/bin/env bash
#
# Backup do banco de produção — Fase E, item 14 do PLANO-IMPLANTACAO.md.
# (O free tier do Supabase não tem backup automático; sem isto aqui não há
# como recuperar dados apagados por engano.)
#
# Rodo no GitHub Actions (semanal, .github/workflows/backup.yml) e localmente:
#
#   SUPABASE_DB_URL='postgres://postgres.<ref>:<senha>@...supabase.co:6543/postgres' \
#   BACKUP_PASSPHRASE='...' \
#     bash scripts/backup-postgres.sh
#
# O dump sai CRIPTOGRAFADO (GPG simétrico AES-256): o repositório é público e
# artefato do Actions não é lugar seguro para dado cru (inclui auth.users).
#
# Restaurar:
#   gpg -d backup-AAAA-MM-DD.sql.gz.gpg | gunzip | psql "$SUPABASE_DB_URL"
#
# Requisitos: docker + a senha do banco (Project Settings → Database).
# O host do SUPABASE_DB_URL precisa ser alcançável a partir de um container.
set -euo pipefail

: "${SUPABASE_DB_URL:?SUPABASE_DB_URL não definido — é o secret do GitHub}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE não definido — é o secret do GitHub}"

# pg_dump precisa ser MAIOR OU IGUAL à versão do servidor (regra do
# PostgreSQL). postgres:18 cobre servidores 17 e 18; suba PG_IMAGE se o
# Supabase subir de major (o script confere e barra antes de dumpar).
PG_IMAGE="${PG_IMAGE:-postgres:18-alpine}"
SAIDA="backup-$(date -u +%F).sql.gz.gpg"

# nunca imprimir a senha que está na connection string
alvo_seguro() { printf '%s' "$1" | sed -E 's#^([^:]+://[^:/@]+):[^@]*@#\1:***@#'; }

echo "→ alvo:  $(alvo_seguro "$SUPABASE_DB_URL")"
echo "→ imagem: $PG_IMAGE"

SERVIDOR="$(docker run --rm "$PG_IMAGE" psql "$SUPABASE_DB_URL" -tAc 'show server_version' | tr -d '[:space:]')"
# corta tudo a partir do primeiro não-dígito ("17.11" → "17", "18-alpine" → "18")
MAJOR_SERVIDOR="${SERVIDOR%%[!0-9]*}"
MAJOR_DUMP="${PG_IMAGE#*:}"
MAJOR_DUMP="${MAJOR_DUMP%%[!0-9]*}"
echo "→ servidor: PostgreSQL $SERVIDOR"
if [ "$MAJOR_DUMP" -lt "$MAJOR_SERVIDOR" ]; then
  echo "✗ pg_dump $MAJOR_DUMP < servidor $MAJOR_SERVIDOR — defina PG_IMAGE maior" >&2
  exit 1
fi

# --exclude-schema=extensions é de propósito: são DDLs declarativas
# (CREATE EXTENSION), já presentes num projeto Supabase novo, e são a maior
# fonte de erro em restore. Dado vivo (public/auth/storage/vault) entra tudo.
docker run --rm "$PG_IMAGE" pg_dump \
  --no-owner --no-privileges --exclude-schema=extensions \
  --dbname="$SUPABASE_DB_URL" |
  gzip -9 |
  gpg --batch --yes --symmetric --cipher-algo AES256 \
    --output "$SAIDA" --passphrase-fd 3 \
    3<<<"$BACKUP_PASSPHRASE"

# round-trip obrigatório: se o dump não abrir/descomprimir, o backup é lixo
# e o workflow tem que falhar agora, não numa restauração de emergência.
gpg --batch --quiet --passphrase-fd 3 -d "$SAIDA" 3<<<"$BACKUP_PASSPHRASE" |
  gzip -t

TAMANHO="$(du -h "$SAIDA" | cut -f1)"
echo "✓ $SAIDA — $TAMANHO · dump + gzip + AES-256 · round-trip OK"

if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "### Backup do banco — $(date -u +%F)"
    echo ""
    echo "- arquivo: \`$SAIDA\` ($TAMANHO)"
    echo "- dump PostgreSQL $SERVIDOR · gzip · AES-256 (GPG)"
    echo "- round-trip (decripta + descomprime) verificado"
    echo "- restaurar: \`gpg -d $SAIDA | gunzip | psql \"\$SUPABASE_DB_URL\"\`"
  } >>"$GITHUB_STEP_SUMMARY"
fi
