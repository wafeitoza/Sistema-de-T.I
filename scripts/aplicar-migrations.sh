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
# (a mesma tabela que o CLI do Supabase usa). Atenção ao formato dela: a
# coluna `version` guarda SÓ o timestamp (`20261006030000`) e `name` guarda
# só o resto (`reserva_sequencias`) — por isso a comparação é pelo prefixo de
# 14 dígitos do arquivo, nunca pelo nome inteiro (bug medido em 19/10/2026:
# comparar o nome completo não casava com nada e o script tentou reaplicar as
# 16 migrations; a primeira falhou por `already exists` — e foi a falha que
# evitou dano, mas por sorte: create table sem if not exists).
#
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
# Em caso de erro, devolve a mensagem da API (visível no log do workflow).
executar_sql() {
  local arquivo="$1" resposta erro
  resposta=$(curl -sS -X POST "$API/database/query" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    --data "$(python3 -c 'import json,sys; print(json.dumps({"query": open(sys.argv[1]).read()}))' "$arquivo")")
  if erro=$(printf '%s' "$resposta" | python3 -c '
import json, sys
bruto = sys.stdin.read()
try:
    dados = json.loads(bruto)
except Exception:
    print("resposta não-JSON: " + bruto[:300]); sys.exit(1)
if isinstance(dados, dict) and dados.get("message"):
    print(dados["message"]); sys.exit(1)
'); then
    echo "  aplicada ✅"
  else
    echo "  FALHOU ❌  ${erro}" >&2
    return 1
  fi
}

echo "== Histórico de migrations no banco remoto (versions) =="
aplicadas=$(consultar_valor "select version from supabase_migrations.schema_migrations order by version" || true)
echo "$aplicadas" | sed 's/^/  ✓ /'

# seleciona o que vai rodar — comparação pelo prefixo de 14 dígitos (version)
pendente() {
  local nome="$1" versao
  versao=$(printf '%s' "$nome" | grep -o '^[0-9]\{14\}' || true)
  [ -n "$versao" ] || return 0                    # sem timestamp = roda sempre? não: exige formato
  ! grep -qx "$versao" <<< "$aplicadas"
}

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
    case "$nome" in
      [0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]_*)
        if pendente "$nome"; then selecionados+=("$nome"); fi ;;
      *)
        echo "  ⚠ ignorado (sem timestamp no início): $nome" >&2 ;;
    esac
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
consultar_valor "select version from supabase_migrations.schema_migrations order by version" | sed 's/^/  ✓ /'
