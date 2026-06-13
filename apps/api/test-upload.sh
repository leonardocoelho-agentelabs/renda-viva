#!/bin/bash
# Teste do endpoint de upload
# 1. Pegue o token: abra o browser em rendavivaapp.com, abra DevTools > Application >
#    Local Storage > encontre sb-*-auth-token > copie o access_token
# 2. Cole abaixo e execute: bash test-upload.sh

TOKEN="${1:-COLE_TOKEN_AQUI}"
API_URL="${2:-http://localhost:3001/api}"
TEST_FILE="${3:-/tmp/test.csv}"

# Criar CSV de teste se não existir
if [ ! -f "$TEST_FILE" ]; then
  echo "Data,Descrição,Valor" > "$TEST_FILE"
  echo "2024-01-15,Mercado,-250.00" >> "$TEST_FILE"
  echo "2024-01-16,Salário,5000.00" >> "$TEST_FILE"
  echo "Arquivo de teste criado: $TEST_FILE"
fi

echo "=== Testando health ==="
curl -s "$API_URL/health" | jq . 2>/dev/null || curl -s "$API_URL/health"

echo ""
echo "=== Testando upload ==="
curl -v -X POST "$API_URL/uploads" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$TEST_FILE" \
  2>&1

echo ""
echo "=== Uso: ==="
echo "  bash test-upload.sh <TOKEN> <API_URL> <ARQUIVO>"
echo "  bash test-upload.sh eyJhbGci... https://rendavivaapp.com/api /tmp/extrato.csv"
