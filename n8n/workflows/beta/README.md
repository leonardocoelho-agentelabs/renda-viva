# Relatório Narrativo Mensal — Beta fase 1

Geração automática do relatório financeiro mensal narrado pelo Viva (Claude).

## Pré-requisitos de infraestrutura

### 1. Bucket no Supabase Storage

Criar um bucket **privado** chamado `relatorios`:

- Supabase Dashboard → **Storage** → **New bucket**
- Nome: `relatorios`
- **Public: NÃO** (privado — o acesso é feito pelo backend com service role)

Os relatórios são salvos em `relatorios/{userId}/{mes_ano}.md` (ex.: `relatorios/<uuid>/2026-05.md`).

### 2. Variável de ambiente da API

Adicionar ao `.env` da API (apps/api):

```
API_SECRET=renda-viva-internal-secret-2026
```

Usada para autenticar os endpoints internos chamados pelo n8n
(`/api/reports/generate-all` e `/api/reports/users-active`) via header `x-api-secret`.

## Endpoints

| Método | Rota | Auth | Descrição |
| --- | --- | --- | --- |
| POST | `/api/reports/generate` | JWT do usuário | Gera e salva o relatório (default: mês anterior). Body opcional `{ mes_ano }`. |
| GET | `/api/reports/list` | JWT do usuário | Lista relatórios do usuário no Storage. |
| GET | `/api/reports/:mes_ano` | JWT do usuário | Retorna o conteúdo de um relatório. |
| GET | `/api/reports/users-active` | `x-api-secret` | (interno) lista usuários para o n8n. |
| POST | `/api/reports/generate-all` | `x-api-secret` | (interno) gera o relatório de todos os usuários. |

## Workflow n8n

`monthly-report.json` — importar no n8n.

- **Trigger:** Cron, dia 1 de cada mês às 06:00.
- **Ação:** HTTP POST para `/api/reports/generate-all` com header `x-api-secret` (use `$env.API_SECRET` no n8n).
- O endpoint `generate-all` já itera sobre todos os usuários no servidor, gerando e
  persistindo cada relatório no Storage.

> **Pendente para fase seguinte:** envio por e-mail. Hoje o workflow gera e persiste os
> relatórios; o usuário os acessa em `/reports`. Para entrega por e-mail, adicionar um nó
> de e-mail (SMTP/Resend) iterando sobre `users-active` + `GET /:mes_ano`.
