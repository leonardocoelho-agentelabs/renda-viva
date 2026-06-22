import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  // Supabase
  SUPABASE_URL: z.string().url("SUPABASE_URL deve ser uma URL válida"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY é obrigatória"),
  SUPABASE_ANON_KEY: z.string().min(1, "SUPABASE_ANON_KEY é obrigatória"),

  // Claude
  CLAUDE_API_KEY: z.string().min(1, "CLAUDE_API_KEY é obrigatória"),

  // OpenAI (Whisper)
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY é obrigatória"),

  // Secret para endpoints internos (n8n, jobs)
  API_SECRET: z.string().min(1, "API_SECRET é obrigatória"),

  // Evolution API (WhatsApp)
  EVOLUTION_URL: z.string().url().default("http://localhost:8080"),
  EVOLUTION_INSTANCE: z.string().min(1).default("Leonardo"),
  EVOLUTION_API_KEY: z.string().min(1, "EVOLUTION_API_KEY é obrigatória"),
  // Número de teste para alertas (futuramente virá de users.telefone)
  ALERTS_TEST_NUMBER: z.string().min(1).default("5511951474246"),

  // Pluggy (Open Finance) - opcional até integração estar ativa
  PLUGGY_CLIENT_ID: z.string().optional().default(""),
  PLUGGY_CLIENT_SECRET: z.string().optional().default(""),
  // Não usada pelo serviço (a API key é obtida via /auth com clientId+secret), mantida por compatibilidade.
  PLUGGY_API_KEY: z.string().optional().default(""),
  PLUGGY_WEBHOOK_URL: z.string().default("https://rendavivaapp.com/api/openfinance/webhook"),
  PLUGGY_WEBHOOK_SECRET: z.string().optional().default(""),

  // Redis
  REDIS_URL: z.string().url("REDIS_URL deve ser uma URL válida"),

  // Server
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),

  // JWT
  JWT_SECRET: z.string().min(1, "JWT_SECRET é obrigatória"),

  // Asaas (Assinaturas)
  ASAAS_API_KEY: z.string(),
  ASAAS_API_URL: z.string().default("https://api-sandbox.asaas.com/v3"),
  ASAAS_WEBHOOK_TOKEN: z.string(),

  // Node env
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const errors = parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`);
  console.error("❌ Erro de validação de variáveis de ambiente:\n");
  errors.forEach((err) => console.error(`  - ${err}`));
  console.error("\nVerifique seu arquivo .env e tente novamente.");
  process.exit(1);
}

export const env = parsed.data;

console.log(`✅ Ambiente carregado: ${env.NODE_ENV}`);
console.log(`   Porta: ${env.PORT}`);
console.log(`   Supabase: ${env.SUPABASE_URL}`);