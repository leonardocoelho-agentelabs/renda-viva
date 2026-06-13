#!/bin/bash
# Importa e ativa os workflows do Renda Viva no n8n via API pública (v1).
#
# Uso:
#   bash scripts/import-n8n-workflows.sh SUA_N8N_API_KEY [N8N_URL]
#
# Exemplos:
#   bash scripts/import-n8n-workflows.sh eyJhbGci...        # usa http://localhost:5678
#   bash scripts/import-n8n-workflows.sh eyJhbGci... https://n8n.vps1027.panel.speedfy.host
#
# Para obter a API key do n8n:
#   Painel do n8n -> ícone do usuário -> Settings -> n8n API -> Create an API key
#
# Observações importantes:
#   - A API pública do n8n aceita UM workflow por requisição, com APENAS os campos
#     name, nodes, connections, settings e staticData. Os arquivos em
#     n8n/workflows/beta/*.json já estão nesse formato (um workflow por arquivo).
#   - O campo "active" é somente-leitura na criação. A ativação é feita em uma
#     chamada separada: POST /api/v1/workflows/{id}/activate.
#   - Este script usa apenas curl + grep/sed (sem dependência de python), para
#     funcionar igual em Linux, macOS e Git Bash no Windows.

set -euo pipefail

N8N_API_KEY="${1:-}"
N8N_URL="${2:-http://localhost:5678}"

# Diretório dos workflows (relativo à raiz do projeto)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKFLOWS_DIR="$SCRIPT_DIR/../n8n/workflows/beta"

if [ -z "$N8N_API_KEY" ]; then
  echo "Uso: bash scripts/import-n8n-workflows.sh SUA_N8N_API_KEY [N8N_URL]"
  echo ""
  echo "Para obter a API key do n8n:"
  echo "  1. Acesse o painel do n8n"
  echo "  2. Ícone do usuário -> Settings -> n8n API"
  echo "  3. Crie uma nova API key"
  exit 1
fi

# Extrai o id do workflow (nanoid sem hífens) da resposta de criação.
# Os ids de nós e de versão são UUIDs (contêm hífens), então o padrão
# "id":"<alfanumérico sem hífen>" casa apenas com o id do workflow.
extrair_workflow_id() {
  grep -oE '"id":"[A-Za-z0-9]+"' | sed -E 's/"id":"([A-Za-z0-9]+)"/\1/' | head -1 || true
}

# Extrai o valor de "active" (true/false) de uma resposta.
extrair_active() {
  grep -oE '"active":(true|false)' | sed -E 's/"active"://' | head -1 || true
}

echo "=== Importando workflows no n8n ==="
echo "n8n: $N8N_URL"
echo "Pasta: $WORKFLOWS_DIR"
echo ""

# Verifica conectividade / autenticação
echo "Verificando acesso à API..."
HTTP_CODE="$(curl -s -o /dev/null -w '%{http_code}' \
  "$N8N_URL/api/v1/workflows?limit=1" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" || true)"

if [ "$HTTP_CODE" != "200" ]; then
  echo "ERRO: a API do n8n respondeu HTTP $HTTP_CODE."
  echo "Verifique a URL, se a API pública está habilitada e se a API key é válida."
  exit 1
fi
echo "OK (HTTP 200)."
echo ""

RESUMO=()

importar_e_ativar() {
  local file="$1"
  local nome
  nome="$(basename "$file")"

  echo "-> Importando $nome ..."
  local resp
  resp="$(curl -s -X POST "$N8N_URL/api/v1/workflows" \
    -H "X-N8N-API-KEY: $N8N_API_KEY" \
    -H "Content-Type: application/json" \
    --data-binary @"$file" || true)"

  local id
  id="$(printf '%s' "$resp" | extrair_workflow_id)"

  if [ -z "$id" ]; then
    echo "   FALHA ao importar $nome. Resposta da API:"
    echo "   $resp"
    RESUMO+=("FALHA  $nome")
    return 1
  fi

  echo "   Importado. id=$id"

  echo "   Ativando..."
  local act ativo
  act="$(curl -s -X POST "$N8N_URL/api/v1/workflows/$id/activate" \
    -H "X-N8N-API-KEY: $N8N_API_KEY" || true)"
  ativo="$(printf '%s' "$act" | extrair_active)"
  [ -z "$ativo" ] && ativo="?"
  echo "   Ativo: $ativo"

  RESUMO+=("OK     $nome (id=$id, active=$ativo)")
}

erros=0
for file in "$WORKFLOWS_DIR"/*.json; do
  [ -e "$file" ] || continue
  importar_e_ativar "$file" || erros=$((erros + 1))
  echo ""
done

echo "=== Resumo desta execução ==="
for linha in "${RESUMO[@]}"; do
  echo "  $linha"
done

if [ "$erros" -gt 0 ]; then
  echo ""
  echo "Concluído com $erros erro(s) de importação."
  exit 1
fi

echo ""
echo "=== Workflows importados e ativados! ==="
