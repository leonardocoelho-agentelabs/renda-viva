# Renda Viva

SaaS de gestão financeira pessoal com IA.

## Stack

- **Frontend**: Next.js 14 + TypeScript + TailwindCSS
- **Backend**: Fastify + TypeScript
- **Banco de dados**: Supabase (PostgreSQL)
- **Automação**: n8n
- **IA**: Claude API (Anthropic)

## Estrutura do Monorepo

```
renda-viva/
├── apps/
│   ├── web/          # Frontend Next.js
│   └── api/          # Backend Fastify
├── packages/
│   └── types/        # Tipos TypeScript compartilhados
├── supabase/
│   ├── migrations/   # Migrações do banco
│   └── seed/         # Dados iniciais
└── n8n/
    └── workflows/    # Workflows de automação
```

## Getting Started

### Pré-requisitos

- Node.js 18+
- pnpm 8+
- Git

### Instalação

```bash
# Instalar dependências
pnpm install

# Configurar variáveis de ambiente
cp .env.example .env
# Edite o .env com suas credenciais

# Iniciar desenvolvimento
pnpm dev
```

### Scripts Disponíveis

- `pnpm dev` - Iniciar todos os apps em modo desenvolvimento
- `pnpm build` - Build de todos os apps
- `pnpm lint` - Verificar código de todos os apps

## Apps

### Web (Frontend)
- URL: http://localhost:3000
- Stack: Next.js 14, TypeScript, TailwindCSS, shadcn/ui

### API (Backend)
- URL: http://localhost:3001
- Stack: Fastify, TypeScript, Supabase

## Licença

MIT
