#!/bin/bash
# Executar UMA VEZ no servidor via SSH
# ssh root@209.50.228.160 "bash -s" < server-setup.sh

set -e

SERVER_DIR="/root/renda-viva"

echo "=== Configurando servidor Renda Viva ==="

# Criar diretórios
mkdir -p $SERVER_DIR/api/dist
mkdir -p $SERVER_DIR/web
mkdir -p $SERVER_DIR/web/public
mkdir -p $SERVER_DIR/web/.next/static

# Garantir que PM2 inicie no boot
pm2 startup systemd -u root --hp /root 2>/dev/null || true
pm2 save

echo ""
echo "=== Servidor configurado! ==="
echo ""
echo "Próximos passos:"
echo "1. Crie os arquivos .env no servidor:"
echo "   $SERVER_DIR/api/.env"
echo "   $SERVER_DIR/web/.env"
echo ""
echo "2. Faça o deploy:"
echo "   cd /root/renda-viva"
echo "   bash deploy.sh"
echo ""
echo "3. Verifique os serviços:"
echo "   pm2 list"