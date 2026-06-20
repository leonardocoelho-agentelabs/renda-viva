# WhatsApp Integration — Evolution API

## Configuração da Evolution API

### Dados da Instância
- **URL**: `http://localhost:8080` (Evolution API rodando em Docker)
- **Instância**: `Leonardo`
- **API Key**: Configurar em `apps/api/.env.production` como `EVOLUTION_API_KEY`
- **Número**: `5511966704895`

### Verificação de Status

```bash
# 1. Verificar instâncias ativas
curl -s http://localhost:8080/instance/fetchInstances -H "apikey: SUA_API_KEY"

# 2. Verificar se está conectada
curl -s http://localhost:8080/instance/connectionState/Leonardo -H "apikey: SUA_API_KEY"
# Esperado: {"instance":{"instanceName":"Leonardo","state":"open"}}

# 3. Verificar webhook configurado
curl -s http://localhost:8080/webhook/find/Leonardo -H "apikey: SUA_API_KEY"
# Esperado: url deve ser "https://rendavivaapp.com/api/whatsapp/webhook"
```

### Reconectar se Desconectado

Se `state` não for `"open"`:
1. Acesse o dashboard da Evolution API
2. Escaneie o QR Code novamente
3. Aguarde status "connected"

### Reconfigurar Webhook (se necessário)

```bash
curl -X POST http://localhost:8080/webhook/set/Leonardo \
  -H "apikey: SUA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "webhook": {
      "url": "https://rendavivaapp.com/api/whatsapp/webhook",
      "enabled": true,
      "events": ["MESSAGES_UPSERT"]
    }
  }'
```

## Variáveis de Ambiente

No `.env.production` devem estar presentes:
```bash
EVOLUTION_URL=http://localhost:8080
EVOLUTION_INSTANCE=Leonardo
EVOLUTION_API_KEY=SUA_API_KEY_AQUI
```

## Troubleshooting

### Mensagens não chegam
1. Verificar se webhook está apontando para URL correta
2. Verificar se instância está com `state: "open"`
3. Verificar logs: `pm2 logs renda-viva-api --lines 50 --nostream`

### Erro de rede (Docker para API)
Se o container Docker não consegue alcançar a API:
```bash
docker exec evolution-api curl -s https://rendavivaapp.com/health
```
