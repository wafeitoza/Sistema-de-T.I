#!/usr/bin/env bash
# Aplica migrations de supabase/migrations/ no banco REMOTO (produção).
#
# Uso (geralmente pelo workflow `.github/workflows/db-migrate.yml`):
#   SUPABASE_ACCESS_TOKEN='sbp_…' SUPABASE_PROJECT_REF='ftwax…' \
#   MIGRATIONS='20261015200000_chamados.sql' scripts/aplicar-migrations.sh
#
#   MIGRATIONS  lista separada por vírgula de arquivos EXATOS de
#               supabase/migrations/. Vazio = todas as que ainda não rodaram.
#
# Por que a Management API e não `supabase db push`: push exige a senha do
# banco (que ninguém tem à mão na hora do incidente). O PAT que o backup já
# usa alcança o endpoint /database/query — mesma credencial, sem segredo novo.
#
# Idempotência: o histórico vem de `supabase_migrations.schema_migrations`
# (a mesma tabela que o CLI do Supabase usa); o que já rodou não roda de novo.
# Entre arquivos NÃO há transação: se uma falhar no meio, as anteriores
# permanecem aplicadas e esta fica marcada como pendente — corrija o SQL e
# rode de novo.
set -euo pipefail

TOKEN="${SUPABASE_ACCESS_TOKEN:-}"
REF="${SUPABASE_PROJECT_REF:-}"
if [ -z "$TOKEN" ] || [ -z "$REF" ]; then
  echo "ERRO: defina SUPABASE_ACCESS_TOKEN e SUPABASE_PROJECT_REF." >&2
  exit 1
fi

API="https://api.supabase.com/v1/projects/$REF"
DIR="$(cd "$(dirname "$0")/.." && pwd)/supabase/migrations"

# Envia um SELECT e devolve só o valor da primeira coluna da primeira linha,
# uma por linha. Erro da API (mensagem em JSON) explode com o corpo na cara.
consultar_valor() {
  local sql="$1" resposta
  resposta=$(curl -sS -X POST "$API/database/query" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    --data "$(python3 -c 'import json,sys; print(json.dumps({"query": sys.argv[1]}))' "$sql")")
  printf '%s' "$resposta" | python3 -c '
import json, sys
bruto = sys.stdin.read()
try:
    dados = json.loads(bruto)
except Exception:
    print("resposta não-JSON: " + bruto[:300], file=sys.stderr); sys.exit(1)
if isinstance(dados, dict) and dados.get("message"):
    print(dados["message"], file=sys.stderr); sys.exit(1)
if not isinstance(dados, list) or not dados:
    sys.exit(0)
for linha in dados:
    if isinstance(linha, dict) and linha:
        print(next(iter(linha.values())))
'
}

# Envia um script SQL completo (múltiplos statements) como uma chamada.
executar_sql() {
  local arquivo="$1" resposta
  resposta=$(curl -sS -X POST "$API/database/query" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    --data "$(python3 -c 'import json,sys; print(json.dumps({"query": open(sys.argv[1]).read()}))' "$arquivo")")
  if printf '%s' "$resposta" | python3 -c '
import json, sys
bruto = sys.stdin.read()
try:
    dados = json.loads(bruto)
except Exception:
    print("resposta não-JSON: " + bruto[:300], file=sys.stderr); sys.exit(1)
if isinstance(dados, dict) and dados.get("message"):
    print("FALHOU: " + dados["message"], file=sys.stderr); sys.exit(1)
' 2>/dev/null; then
    echo "  aplicada ✅"
  else
    echo "  FALHOU ❌" >&2
    return 1
  fi
}

echo "== Histórico de migrations no banco remoto =="
aplicadas=$(consultar_valor "select name from supabase_migrations.schema_migrations order by name" || true)
echo "$aplicadas" | sed 's/^/  ✓ /'

# seleciona o que vai rodar
selecionados=()
if [ -n "${MIGRATIONS:-}" ]; then
  IFS=',' read -ra pedidos <<< "$MIGRATIONS"
  for p in "${pedidos[@]}"; do
    p="$(echo "$p" | xargs)"
    [ -f "$DIR/$p" ] || { echo "ERRO: migration '$p' não existe em supabase/migrations/" >&2; exit 1; }
    selecionados+=("$p")
  done
else
  for f in "$DIR"/*.sql; do
    nome=$(basename "$f")
    if ! grep -qx "$nome" <<< "$aplicadas"; then
      selecionados+=("$nome")
    fi
  done
fi

if [ "${#selecionados[@]}" -eq 0 ]; then
  echo "== Nada pendente: banco já está atualizado =="
  exit 0
fi

echo "== Vai aplicar: ${selecionados[*]} =="
for nome in "${selecionados[@]}"; do
  echo "-- $nome"
  executar_sql "$DIR/$nome"
done

echo "== Concluído. Histórico atualizado: =="
consultar_valor "select name from supabase_migrations.schema_migrations order by name" | sed 's/^/  ✓ /'
