#!/bin/bash
set -e
SERVER="root@209.50.228.160"
SERVER_DIR="/root/renda-viva-src"
PASSWORD="OWWx9Ab2AJs3rsPT"

# Função para executar comando via SSH
run_ssh() {
  sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no root@209.50.228.160 "$1"
}

echo "=== Deploy Renda Viva ==="

echo ""
echo "1. Atualizando código no servidor..."
run_ssh "cd $SERVER_DIR && git pull origin main 2>/dev/null || git clone https://github.com/leonardocoelho-agentelabs/renda-viva.git $SERVER_DIR"

echo ""
echo "2. Instalando dependências..."
run_ssh "cd $SERVER_DIR && pnpm install"

echo ""
echo "3. Build da API..."
run_ssh "cd $SERVER_DIR/apps/api && pnpm build"

echo ""
echo "4. Build do Frontend..."
run_ssh "cd $SERVER_DIR/apps/web && pnpm build"

echo ""
echo "5. Configurando variáveis de ambiente..."
echo "   ATENÇÃO: Configure manualmente os arquivos .env no servidor"
echo "   /root/renda-viva-src/apps/api/.env"
echo "   /root/renda-viva-src/apps/web/.env.local"

echo ""
echo "6. Iniciando serviços com PM2..."

# Renomear arquivo da API de .cjs para .js
run_ssh "cd $SERVER_DIR/apps/api/dist && mv app.cjs app.js 2>/dev/null || true"

# Parar e iniciar serviços
run_ssh "
  cd $SERVER_DIR

  # Parar processos existentes
  pm2 delete renda-viva-api 2>/dev/null || true
  pm2 delete renda-viva-web 2>/dev/null || true

  # Iniciar API
  pm2 start apps/api/dist/app.js --name renda-viva-api --env production -- --port 3001

  # Iniciar Web (Next.js standalone)
  cd apps/web/.next/standalone && pm2 start 'node server.js' --name renda-viva-web --env production -- -p 3000

  pm2 save
  pm2 list
"

echo ""
echo "=== Deploy concluído! ==="
echo ""
echo "Testando serviços..."
sleep 3

echo ""
echo "API Health:"
run_ssh "curl -s http://localhost:3001/api/health 2>/dev/null || echo 'API não está respondendo'"

echo ""
echo "Frontend:"
run_ssh "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000 2>/dev/null || echo 'Frontend não está respondendo'"