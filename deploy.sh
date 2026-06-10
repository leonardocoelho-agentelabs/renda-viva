#!/bin/bash
# Script de deploy do Renda Viva
# Executar localmente: bash deploy.sh

set -e

SERVER="root@209.50.228.160"
APP_DIR="/root/renda-viva"

echo "=== Deploy Renda Viva ==="

echo "1. Enviando código para o servidor..."
ssh $SERVER "mkdir -p $APP_DIR/api/dist $APP_DIR/web/public $APP_DIR/web/.next/static"

# Enviar apps/api/dist
rsync -avz --delete \
  /c/Users/Dell/renda-viva/apps/api/dist/ \
  $SERVER:$APP_DIR/api/dist/

# Enviar apps/api/package.json e pnpm-lock
rsync -avz \
  /c/Users/Dell/renda-viva/apps/api/package.json \
  /c/Users/Dell/renda-viva/apps/api/pnpm-lock.yaml \
  $SERVER:$APP_DIR/api/

# Enviar apps/web/.next/standalone
rsync -avz --delete \
  /c/Users/Dell/renda-viva/apps/web/.next/standalone/ \
  $SERVER:$APP_DIR/web/

# Enviar apps/web/.next/static para dentro do standalone
rsync -avz --delete \
  /c/Users/Dell/renda-viva/apps/web/.next/static/ \
  $SERVER:$APP_DIR/web/.next/static/

# Enviar apps/web/public
rsync -avz --delete \
  /c/Users/Dell/renda-viva/apps/web/public/ \
  $SERVER:$APP_DIR/web/public/

# Enviar ecosystem config
rsync -avz \
  /c/Users/Dell/renda-viva/apps/ecosystem.config.js \
  $SERVER:$APP_DIR/

echo "2. Instalando dependências no servidor..."
ssh $SERVER "cd $APP_DIR/api && pnpm install --prod"

echo "3. Reiniciando serviços com PM2..."
ssh $SERVER "
  cd $APP_DIR

  # Iniciar ou reiniciar API
  pm2 describe renda-viva-api > /dev/null 2>&1 \
    && pm2 restart renda-viva-api \
    || pm2 start $APP_DIR/api/dist/app.cjs --name renda-viva-api

  # Iniciar ou reiniciar Web
  pm2 describe renda-viva-web > /dev/null 2>&1 \
    && pm2 restart renda-viva-web \
    || pm2 start $APP_DIR/web/server.js --name renda-viva-web

  pm2 save
  pm2 list
"

echo "=== Deploy concluído! ==="
echo "Frontend: https://rendavivaapp.com"
echo "API: https://rendavivaapp.com/api/health"