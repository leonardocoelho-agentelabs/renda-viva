# Auditoria de Segurança — Renda Viva

**Data:** 02 de junho de 2026  
**Versão:** 1.0  
**Escopo:** Autenticação, Dados Financeiros, API, Infraestrutura, Conformidade LGPD  
**Metodologia:** Análise estática de código, revisão de migrations, verificação de endpoints

---

## Resumo Executivo

| Severidade | Quantidade |
|------------|------------|
| 🔴 CRÍTICO | 5 |
| 🟠 ALTO | 7 |
| 🟡 MÉDIO | 6 |
| 🟢 BAIXO | 4 |

**Total de problemas encontrados:** 22

---

## 🔴 CRÍTICO (corrigir imediatamente)

### C1. Credenciais hardcoded no arquivo de configuração

**Descrição:** O arquivo `apps/api/src/env.ts` contém valores padrão hardcoded para secrets críticos que são usados quando as variáveis de ambiente não estão definidas. Esses valores padrão são extremamente fracos e previsíveis.

**Arquivo/linha afetada:**
- `apps/api/src/env.ts:17` — `API_SECRET: z.string().min(1).default("renda-viva-internal-secret-2026")`
- `apps/api/src/env.ts:22` — `EVOLUTION_API_KEY: z.string().min(1).default("G6hJn4M6mEPryjQHpptXAesAdjnbahpW")`
- `apps/api/src/env.ts:40` — `JWT_SECRET: z.string().min(1).default("change-me-in-production")`
- `apps/api/src/env.ts:27-28` — `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` com valores default

**Risco:** Em ambiente de desenvolvimento ou containers mal configurados, o sistema pode iniciar com essas credenciais fracas. Um atacante que descubra esses valores padrão pode:
- Acessar a API internamente
- Autenticar em endpoints protegidos com JWT forjado
- Controlar a integração WhatsApp
- Controlar conexões bancárias via Open Finance

**Correção recomendada:**
- Remover todos os valores `default` de secrets críticos
- Impedir que o aplicativo inicie se `NODE_ENV === "production"` e secrets não estiverem definidos
- Adicionar validação que falhe em produção se os valores padrão forem detectados

---

### C2. Webhooks sem autenticação JWT expostos publicamente

**Descrição:** Três webhooks aceitam requisições sem qualquer verificação de autenticação JWT, relying solely on token headers que podem ser forjados ou não validados adequadamente.

**Arquivos/linhas afetadas:**
- `apps/api/src/modules/openfinance/routes.ts:158-160` — `POST /openfinance/webhook` (Pluggy)
- `apps/api/src/modules/whatsapp/webhook.routes.ts:10` — `POST /whatsapp/webhook` (Evolution API)
- `apps/api/src/modules/subscriptions/webhook.routes.ts:9` — `POST /subscriptions/webhook/asaas`

**Risco:** Um atacante pode:
- Enviar transações falsas via webhook do WhatsApp, poluindo dados financeiros do usuário
- Iniciar sincronizações não autorizadas via webhook Pluggy
- Modificar status de assinaturas via webhook Asaas

**Correção recomendada:**
- Implementar validação de assinatura HMAC para cada webhook (cada provedor tem seu mecanismo)
- Para Asaas: já tem token validation, mas deve verificar também IP allowlist
- Para WhatsApp/Evolution: implementar verificação de assinatura ou IP restriction
- Para Pluggy: usar o mecanismo de assinatura que a API deles fornece

---

### C3. Nome do usuário enviado diretamente ao Claude API sem sanitização (Prompt Injection)

**Descrição:** O nome completo do usuário (`full_name`) é interpolado diretamente no system prompt enviado à API do Claude sem qualquer sanitização ou escaping.

**Arquivo/linha afetada:**
- `apps/api/src/modules/assistant/routes.ts:148` — `"Nome: ${perfil?.full_name || "Usuário"}"`

**Risco:** Um atacante que consiga alterar seu nome de perfil para um texto malicioso pode injetar instruções no prompt do Claude, potencialmente:
- Manipular recomendações financeiras
- Extrair dados de outros usuários (se o modelo for treinado com instruções específicas)
- Realizar ataques de "prompt injection" para ignorar filtros de segurança

**Correção recomendada:**
- Sanitizar `full_name` antes de incluir no prompt: remover caracteres especiais, quebras de linha, e limitar tamanho
- Considerar usar identificadores internos (user_id) ao invés de nome legível
- Implementar uma camada de "prompt sanitization" que limpa inputs de usuário antes de enviar à IA

---

### C4. Vazamento de stack traces em ambiente de produção

**Descrição:** Em múltiplos pontos do código, stack traces completos são logados e podem ser expostos na resposta de erro para o cliente.

**Arquivos/linhas afetadas:**
- `apps/api/src/modules/leaks/routes.ts:361` — Stack trace completo logado com detalhes de erro interno
- `apps/api/src/modules/leaks/routes.ts:424` — Mesmo problema no handler de histórico
- `apps/api/src/modules/uploads/service.ts:253` — Stack trace logado em worker
- `apps/api/src/modules/leaks/routes.ts:359-368` — Detalhes sensíveis incluem `error.hint`, `error.details`, `error.response.data` que podem conter informações internas do banco

**Risco:**
- Exposição de estrutura interna do banco de dados
- Exposição de queries SQL (via stack trace do Supabase)
- Exposição de IPs, portas, e configuração de infraestrutura
- Informações úteis para ataques direcionados

**Correção recomendada:**
- Nunca logar `error.stack` em produção
- No handler de erro global, não incluir `error.hint` ou `error.details`
- Limitar logs de erro a: código do erro, timestamp, request ID (para correlação)
- Implementar um sanitizer de erros que remova campos internos antes de expor ao cliente

---

### C5. Validação de schema ausente em todos os endpoints

**Descrição:** Nenhum endpoint da API usa validação de schema (Fastify schema ou Zod) para validar o payload de entrada. Todos os endpoints aceitam `any` como body.

**Arquivo/linha afetada:**
- Todos os arquivos em `apps/api/src/modules/*/routes.ts` — Nenhum uso de `schema:` encontrado

**Risco:**
- Payload malformado pode causar erros inesperados
- Tipos inválidos podem passar sem validação
- Facilita fuzzing e ataques automatizados
- Bugs silenciosos difíceis de debugar

**Correção recomendada:**
- Implementar validação de schema Zod para todos os corpos de requisição
- Usar Fastify schema validation para querystrings e params
- Retornar erros 400 com mensagens claras quando a validação falhar

---

## 🟠 ALTO (corrigir em breve)

### A1. Rate Limiting não implementado

**Descrição:** Não há nenhuma proteção contra rate limiting em nenhum endpoint da API. Isso permite ataques de brute force e enumeração.

**Arquivo/linha afetada:**
- `apps/api/src/` — Nenhum uso de `rate-limit` ou `rateLimit` encontrado

**Risco:**
- Força bruta em login/cadastro
- Enumeração de IDs de recursos
- DoS através de requisições massivas
- Custo elevado de API (Claude, OpenAI, etc.)

**Correção recomendada:**
- Implementar `@fastify/rate-limit` para todos os endpoints
- Limites específicos:
  - `/auth/*`: 5 tentativas por minuto por IP
  - `/assistant/chat`: 20 requisições por minuto por usuário
  - `/uploads`: 10 uploads por hora por usuário
  - Padrão: 100 requisições por minuto por usuário

---

### A2. CORS configurado com `true` em desenvolvimento permite qualquer origem

**Descrição:** A configuração de CORS permite `true` quando `NODE_ENV !== "production"`, potencialmente permitindo origens arbitrárias.

**Arquivo/linha afetada:**
- `apps/api/src/app.ts:50-52`

```typescript
origin: env.NODE_ENV === "production"
  ? ["https://rendavivaapp.com", "https://rendavivaapp.com"]
  : true,
```

**Risco:** Em ambiente de staging ou se `NODE_ENV` for mal configurado, a API aceita requisições de qualquer origem.

**Correção recomendada:**
- Sempre especificar origens explícitas, mesmo em desenvolvimento
- Usar variável de ambiente para lista de origens permitidas
- Implementar allowlist de origens em produção

---

### A3. select('*') em múltiplos endpoints expõe campos desnecessários

**Descrição:** Múltiplos endpoints usam `select('*')` ou `select("*")` que retornam todos os campos da tabela, incluindo campos internos e metadados.

**Arquivos/linhas afetadas:**
- `apps/api/src/modules/auth/routes.ts:16` — `select("*")` retorna todos os campos de users
- `apps/api/src/modules/budget/routes.ts:81,261` — Pode expor metadados internos
- `apps/api/src/modules/calendar/routes.ts:176,185,374,559,608` — Multiplas consultas com select('*')
- `apps/api/src/modules/goals/routes.ts:58,247`
- `apps/api/src/modules/users/routes.ts:69,75,81,87` — Exportação LGPD usa select('*') em várias tabelas
- `apps/api/src/modules/subscriptions/routes.ts:81,96,160` — Pode expor dados do Asaas

**Risco:**
- Exposição de campos internos (timestamps de criação, IDs de sync, etc.)
- Vazamento de dados via API se novos campos forem adicionados à tabela
- Metadados de sistema expostos ao cliente

**Correção recomendada:**
- Substituir todos os `select('*')` por `select()` com lista explícita de campos
- Criar tipos DTO para cada endpoint que especificam exatamente o que é retornado
- Para exportação LGPD, ser ainda mais restritivo (nunca expor IDs internos)

---

### A4. Webhook WhatsApp aceita qualquer payload e ignora erros silenciosamente

**Descrição:** O webhook do WhatsApp usa `request.body as any` sem validação de schema, e erros são logados mas não interrompem o fluxo.

**Arquivo/linha afetada:**
- `apps/api/src/modules/whatsapp/webhook.routes.ts:11` — `const body = request.body as any`
- `apps/api/src/modules/whatsapp/webhook.routes.ts:160` — Erro é logado mas não retorna erro HTTP (pode causar reenvio pelo provedor)

**Risco:**
- Payload malformado pode causar comportamento inesperado
- O `catch` no final não retorna erro, fazendo o provedor reenviar indefinidamente

**Correção recomendada:**
- Implementar validação Zod do body do webhook
- No catch block, ainda retornar erro HTTP (não só logging)
- Adicionar validação de tipo em todos os campos accessados (ex: `data.key?.id`)

---

### A5. Tabelas sem RLS (ALTER COLUMN ao invés de nova tabela)

**Descrição:** 4 migrations não têm `ENABLE ROW LEVEL SECURITY` mas são apenas alterações de colunas em tabelas já existentes que têm RLS.

**Arquivos afetados:**
- `supabase/migrations/009_transactions_pluggy.sql` — Apenas ADD COLUMN
- `supabase/migrations/010_users_telefone.sql` — Apenas ADD COLUMN
- `supabase/migrations/014_acesso_liberado.sql` — Apenas ADD COLUMN
- `supabase/migrations/016_subscription_cancelado_em.sql` — Apenas ADD COLUMN

**Risco:** Baixo — são apenas colunas adicionadas às tabelas existentes que já têm RLS. O RLS já protege essas colunas.

**Correção recomendada:** Apenas documentar que essas migrations não requerem RLS por serem alterações de schema em tabelas já protegidas. Nenhuma ação necessária.

---

### A6. Ausência de validação de tipo de arquivo por magic bytes

**Descrição:** O upload de arquivos valida apenas a extensão, não o conteúdo real do arquivo.

**Arquivo/linha afetada:**
- `apps/api/src/modules/uploads/routes.ts:46-55`

```typescript
const filename = data.filename.toLowerCase();
const allowedTypes = [".csv", ".pdf", ".ofx"];
const ext = "." + filename.split(".").pop();
if (!allowedTypes.includes(ext)) { ... }
```

**Risco:**
- Upload de arquivos maliciosos com extensão falsa
- Potential XSS se um arquivo HTML for enviado com extensão .pdf
- Bypass de validação de segurança

**Correção recomendada:**
- Implementar verificação de magic bytes (file signature)
- Para CSV: verificar que começa com caracteres válidos
- Para PDF: verificar header `%PDF-`
- Para OFX: verificar header `OFXHEADER` ou `<?xml`

---

### A7. Telefone armazenado sem criptografia (campo indexado)

**Descrição:** O campo `telefone` foi adicionado à tabela users sem criptografia, e existe um índice para busca por telefone.

**Arquivo/linha afetada:**
- `supabase/migrations/010_users_telefone.sql`

```sql
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS telefone TEXT;
CREATE INDEX IF NOT EXISTS idx_users_telefone ON public.users(telefone);
```

**Risco:** O telefone é considerado dado pessoal sensível pela LGPD. Se o banco for comprometido, todos os telefones estão expostos em texto plano.

**Correção recomendada:**
- Criptografar o campo `telefone` usando AES-256 antes de armazenar
- Ou usar o telefone apenas como hash para lookup (como feito em `whatsapp_contacts`)
- Documentar a decisão de design para compliance LGPD

---

## 🟡 MÉDIO (corrigir quando possível)

### M1. Nome do usuário em system prompt sem escaping de Newlines (Possível Prompt Injection Secundário)

**Descrição:** Além do full_name, o bloco de metas também insere dados de usuário no prompt sem sanitização completa.

**Arquivo/linha afetada:**
- `apps/api/src/modules/assistant/routes.ts:117-127`

```typescript
const blocoMetas =
  metas && metas.length > 0
    ? `METAS ATIVAS:\n${metas.map((m) => `- ${m.nome}: R$ ...`).join("\n")}`
    : "";
```

**Risco:** Descrições de metas podem conter newlines ou caracteres especiais que modificam a estrutura do prompt.

**Correção recomendada:**
- Sanitizar todos os campos de usuário antes de interpolar no prompt
- Implementar função de sanitização genérica que remove/escapes caracteres perigosos
- Limitar comprimento de campos antes de interpolar

---

### M2. Log de exportação de dados LGPD expõe user ID

**Descrição:** O endpoint de exportação logs o user ID em texto plano.

**Arquivo/linha afetada:**
- `apps/api/src/modules/users/routes.ts:142`

```typescript
console.log(`[LGPD] Exportação de dados: user ${userId} em ${new Date().toISOString()}`)
```

**Risco:** Em logs de produção, o user ID é exposto junto com timestamps, facilitando correlação de atividades.

**Correção recomendada:**
- Usar logging estruturado que não exponha PII
- Hashear o user ID antes de logar
- Ou usar ID interno de request ao invés de user ID

---

### M3. Sem validação de tamanho de payload JSON

**Descrição:** Não há limite configurado no tamanho do body de requisições JSON.

**Arquivo/linha afetada:**
- `apps/api/src/app.ts` — multipart tem limite de 20MB, mas JSON não tem limite explícito

**Risco:** Ataques de payload massivo podem causar DoS.

**Correção recomendada:**
- Configurar `bodyLimit` no Fastify (ex: 1MB para JSON)
- Adicionar validação de Content-Length header

---

### M4. Política de privacidade existe mas não há evidências de aceite do usuário

**Descrição:** O footer do site tem link para `/privacidade`, mas não há mecanismo de consentimento implementado visível no código.

**Arquivo/linha afetada:**
- `apps/web/src/components/marketing/footer.tsx:7`

**Risco:** Compliance LGPD questionável se não houver registro de aceite do usuário.

**Correção recomendada:**
- Implementar modal de consentimento na primeira visita
- Registrar consentimento no banco de dados com timestamp
- Permitir ao usuário revisar e revogar consentimentos

---

### M5. API secret interna hardcoded como fallback

**Descrição:** A API_SECRET tem um valor padrão que é usado como fallback, permitindo acesso interno sem autenticação em certas condições.

**Arquivo/linha afetada:**
- `apps/api/src/env.ts:17`

```typescript
API_SECRET: z.string().min(1).default("renda-viva-internal-secret-2026"),
```

**Risco:** Se o sistema depender dessa secret para comunicação interna, um atacante pode usar esse valor padrão.

**Correção recomendada:**
- Remover o default completamente
- Impedir startup se API_SECRET não estiver definida em qualquer ambiente

---

### M6. Storage do Supabase pode não ter RLS configurado

**Descrição:** As políticas de RLS foram verificadas em tabelas, mas não foi verificado se o Supabase Storage (bucket "extratos") também tem políticas de acesso.

**Risco:** Se o bucket de storage não tiver RLS, um atacante com a anon key poderia acessar arquivos de outros usuários.

**Correção recomendada:**
- Verificar políticas de acesso no bucket `extratos`
- Implementar políticas baseadas em owner (user_id) para storage
- Documentar configuração de storage RLS

---

## 🟢 BAIXO (boas práticas, não urgente)

### L1. Credenciais do Pluggy em variáveis de ambiente com valores default

**Descrição:** As credenciais do cliente Pluggy têm valores default, embora sejam menos críticos que secrets de autenticação.

**Arquivo/linha afetada:**
- `apps/api/src/env.ts:27-28`

**Risco:** Mínimo — são credenciais de aplicação, não de usuário final.

**Correção recomendada:** Remover defaults, mas menor prioridade.

---

### L2. Sem implementação de refresh token rotation

**Descrição:** O sistema usa JWTs do Supabase mas não implementa rotação explícita de refresh tokens.

**Risco:** Se um refresh token for comprometido, ele pode ser usado indefinidamente.

**Correção recomendada:** Implementar refresh token rotation (Supabase já suporta nativamente).

---

### L3. sem verificação de força de senha

**Descrição:** Não há validação de força de senha no registro de usuário (和政策 de complexidade mínima).

**Risco:** Usuários podem criar senhas fracas que são mais fáceis de quebrar.

**Correção recomendada:** Implementar validação de senha com requisitos mínimos.

---

### L4. sem 2FA/MFA implementado

**Descrição:** O sistema não oferece autenticação de dois fatores.

**Risco:** Se a senha do usuário for comprometida, a conta está completamente exposta.

**Correção recomendada:** Implementar TOTP ou WebAuthn como segunda camada.

---

## Tabela de Endpoints e Autenticação

| Endpoint | Método | Auth | Subscription Check | Observações |
|----------|--------|------|-------------------|-------------|
| `/api/health` | GET | ❌ | ❌ | Público — OK |
| `/api/auth/me` | GET | ✅ | ❌ | — |
| `/api/users/me` | GET | ✅ | ❌ | — |
| `/api/users/me` | PATCH | ✅ | ❌ | — |
| `/api/users/export` | GET | ✅ | ❌ | LGPD |
| `/api/users/me` | DELETE | ✅ | ❌ | Deleta conta |
| `/api/users/modo-crise/*` | GET/PATCH/POST/DELETE | ✅ | ✅ | — |
| `/api/transactions/*` | GET/POST/PATCH/DELETE | ✅ | ✅ | — |
| `/api/budget/*` | GET/POST/PATCH | ✅ | ✅ | — |
| `/api/goals/*` | GET/POST/PATCH/DELETE | ✅ | ✅ | — |
| `/api/recurring/*` | GET/POST/PATCH | ✅ | ✅ | — |
| `/api/uploads/*` | GET/POST | ✅ | ✅ | — |
| `/api/assistant/chat` | POST | ✅ | ✅ | ⚠️ PII no prompt |
| `/api/assistant/history` | GET | ✅ | ✅ | — |
| `/api/diagnostico/*` | GET/POST | ✅ | ✅ | — |
| `/api/leaks/*` | GET/POST | ✅ | ✅ | — |
| `/api/simulator/*` | GET/POST | ✅ | ❌ | — |
| `/api/mentor/*` | GET/POST/DELETE | ✅ | ✅ | — |
| `/api/reports/*` | GET/POST | ✅ | ✅ | — |
| `/api/insights/*` | GET/POST | ✅ | ✅ | — |
| `/api/score/*` | GET/POST | ✅ | ✅ | — |
| `/api/forecast/*` | GET/POST | ✅ | ✅ | — |
| `/api/investments/*` | GET/POST | ✅ | ✅ | — |
| `/api/alerts/*` | POST | ✅ | ✅ | — |
| `/api/subscriptions/me` | GET | ✅ | ❌ | — |
| `/api/subscriptions/checkout` | POST | ✅ | ❌ | — |
| `/api/subscriptions/cancel` | POST | ✅ | ❌ | — |
| `/api/whatsapp/webhook` | POST | ❌ | ❌ | ⚠️ SEM AUTH |
| `/api/whatsapp-contacts/*` | GET/POST/DELETE | ✅ | ❌ | — |
| `/api/openfinance/*` | GET/POST/DELETE | ✅ | ✅ | — |
| `/api/openfinance/webhook` | POST | ❌ | ❌ | ⚠️ SEM AUTH |
| `/api/subscriptions/webhook/asaas` | POST | ❌ | ❌ | ⚠️ Token header apenas |
| `/api/calendar/*` | GET/POST/PATCH | ✅ | ✅ | — |

---

## Checklist LGPD

| Item | Status | Observações |
|------|--------|-------------|
| Exclusão completa de dados | ✅ CONFORME | ON DELETE CASCADE em todas as tabelas com user_id; Supabase Auth deleteUser chamado |
| Exportação de dados (Art. 18) | ⚠️ PARCIAL | Falta: viva_memory, conversation_history, leaks_analysis, simulations, calendar_events, ir_reports, financial_diagnostics, mentor_objectives |
| Política de privacidade | ⚠️ PARCIAL | Link existe mas sem mecanismo de consentimento |
| Base legal para processamento | ❓ NÃO VERIFICADO | Não encontrado documento de base legal |
| Prazo de retenção | ❓ NÃO DEFINIDO | Não encontrado política de retenção |
| Relatório de Impacto (RIPD) | ❓ NÃO VERIFICADO | Recomendado para tratamento de dados financeiros |
| DPO/Encarregado | ❓ NÃO DEFINIDO | Contato de privacidade não exposto |

### Tabelas verificadas para exclusão em cascata:

| Tabela | ON DELETE CASCADE | RLS |
|--------|-------------------|-----|
| users | ✅ | ✅ |
| transactions | ✅ | ✅ |
| budgets | ✅ | ✅ |
| goals | ✅ | ✅ |
| uploads | ✅ | ✅ |
| user_corrections | ✅ | ✅ |
| forecasts | ✅ | ✅ |
| bank_connections | ✅ | ✅ |
| whatsapp_contacts | ✅ | ✅ |
| subscriptions | ✅ | ✅ |
| recurring_commitments | ✅ | ✅ |
| viva_memory | ✅ | ✅ |
| conversation_history | ✅ | ✅ |
| mentor_objectives | ✅ | ✅ |
| financial_diagnostics | ✅ | ✅ |
| simulations | ✅ | ✅ |
| calendar_events | ✅ | ✅ |
| leaks_analysis | ✅ | ✅ |
| ir_reports | ✅ | ✅ |

---

## Recomendações Prioritárias

### Imediato (primeira semana):
1. **C1** — Remover credenciais hardcoded do env.ts
2. **C2** — Implementar autenticação de webhooks
3. **C4** — Remover stack traces de logs/respostas

### Curto prazo (primeiro mês):
4. **C3** — Sanitizar inputs antes de enviar à IA
5. **C5** — Implementar validação de schema
6. **A1** — Implementar rate limiting
7. **A6** — Implementar verificação de magic bytes
8. **M4** — Implementar consentimento LGPD

### Médio prazo (trimestre):
9. **A2** — Corrigir CORS
10. **A3** — Substituir select('*')
11. **A4** — Validar webhook payloads
12. **A7** — Criptografar telefone
13. Preencher lacunas de compliance LGPD

---

## Notas Finais

Esta auditoria focou em análise estática de código e não inclui:
- Testes de penetração dinâmicos
- Verificação de infraestrutura de produção (headers HTTP, portas expostas, etc.)
- Análise de logs de produção
- Revisão de código de workers (OCR queue)
- Verificação de configurações do Supabase (não apenas migrations)

Recomenda-se uma auditoria dinâmica com testes de penetração para complementar esta análise.
