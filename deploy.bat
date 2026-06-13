@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo === Deploy Renda Viva ===
echo.

set SERVER=root@209.50.228.160
set PASS=OWWx9Ab2AJs3rsPT

REM Verificar se plink está disponível
where plink >nul 2>&1
if errorlevel 1 (
    echo [AVISO] plink nao encontrado. Tentando instalar PuTTY...
    winget install PuTTY.PuTTY --silent --accept-source-agreements --accept-package-agreements
    if errorlevel 1 (
        echo [ERRO] Falha ao instalar PuTTY. Instale manualmente em: https://www.chiark.greenend.org.uk/~sgtatham/putty/latest.html
        pause
        exit /b 1
    )
)

echo [1/8] Atualizando codigo no servidor...
plink -ssh -pw %PASS% %SERVER% "cd /root/renda-viva-src && git pull origin main || git clone https://github.com/leonardocoelho-agentelabs/renda-viva.git /root/renda-viva-src"

echo.
echo [2/8] Instalando pnpm 8 no servidor...
plink -ssh -pw %PASS% %SERVER% "npm install -g pnpm@8"

echo.
echo [3/8] Instalando dependencias...
plink -ssh -pw %PASS% %SERVER% "cd /root/renda-viva-src && pnpm install"

echo.
echo [4/8] Build da API...
plink -ssh -pw %PASS% %SERVER% "cd /root/renda-viva-src/apps/api && pnpm build"

echo.
echo [5/8] Build do Frontend...
plink -ssh -pw %PASS% %SERVER% "cd /root/renda-viva-src/apps/web && pnpm build"

echo.
echo [6/8] Criando .env no servidor...

plink -ssh -pw %PASS% %SERVER% "cat > /root/renda-viva-src/apps/api/.env << 'ENVEOF'
SUPABASE_URL=https://lefncllcrnbcclqgysyt.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlZm5jbGxjcm5iY2NscWd5c3l0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMDc4NTQsImV4cCI6MjA5NjU4Mzg1NH0.NV2VBW_erE4vtqGDRLHdQiK3cLGun2cjIY_HECHmQpI
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpZnZnemdpcHVwZnF4aHh1ZGZqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDIyMTkyNiwiZXhwIjoyMDg1Nzk3OTI2fQ.bHm4KS29G91TtKxBsAy_tE7Xb89bgRFM3M-ILtH29QY
CLAUDE_API_KEY=your-claude-api-key-here
REDIS_URL=redis://:redis123@127.0.0.1:6379
PORT=3001
JWT_SECRET=renda-viva-production-secret-2024-secure
NODE_ENV=production
ENVEOF"

plink -ssh -pw %PASS% %SERVER% "cat > /root/renda-viva-src/apps/web/.env.local << 'ENVEOF'
NEXT_PUBLIC_SUPABASE_URL=https://lefncllcrnbcclqgysyt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlZm5jbGxjcm5iY2NscWd5c3l0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMDc4NTQsImV4cCI6MjA5NjU4Mzg1NH0.NV2VBW_erE4vtqGDRLHdQiK3cLGun2cjIY_HECHmQpI
NEXT_PUBLIC_API_URL=https://rendavivaapp.com/api
NODE_ENV=production
ENVEOF"

echo.
echo [7/8] Preparando arquivos e iniciando servicos PM2...

REM Renomear API build
plink -ssh -pw %PASS% %SERVER% "cd /root/renda-viva-src/apps/api/dist && mv app.cjs app.js 2>/dev/null || true"

REM Parar e iniciar servicos
plink -ssh -pw %PASS% %SERVER% "pm2 delete renda-viva-api 2>/dev/null; pm2 delete renda-viva-web 2>/dev/null; pm2 start /root/renda-viva-src/apps/api/dist/app.js --name renda-viva-api -- --port 3001"

plink -ssh -pw %PASS% %SERVER% "cd /root/renda-viva-src/apps/web/.next/standalone && pm2 start server.js --name renda-viva-web -- -p 3000"

plink -ssh -pw %PASS% %SERVER% "pm2 save"

echo.
echo [8/8] Verificando deploy...
echo.
echo --- Status PM2 ---
plink -ssh -pw %PASS% %SERVER% "pm2 list"
echo.
echo --- Teste API ---
plink -ssh -pw %PASS% %SERVER% "curl -s http://localhost:3001/api/health"
echo.
echo --- Teste Frontend ---
plink -ssh -pw %PASS% %SERVER% "curl -s -o /dev/null -w 'HTTP Status: %%{http_code}' http://localhost:3000"
echo.

echo === Deploy concluido! ===
echo Acesse: https://rendavivaapp.com
echo.
pause
endlocal