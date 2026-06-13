import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  // Supabase
  SUPABASE_URL: z.string().url("SUPABASE_URL deve ser uma URL válida"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY é obrigatória"),
  SUPABASE_ANON_KEY: z.string().min(1, "SUPABASE_ANON_KEY é obrigatória"),

  // Claude
  CLAUDE_API_KEY: z.string().min(1, "CLAUDE_API_KEY é obrigatória"),

  // Secret para endpoints internos (n8n, jobs)
  API_SECRET: z.string().min(1).default("renda-viva-internal-secret-2026"),

  // Evolution API (WhatsApp)
  EVOLUTION_URL: z.string().url().default("http://localhost:8080"),
  EVOLUTION_INSTANCE: z.string().min(1).default("Leonardo"),
  EVOLUTION_API_KEY: z.string().min(1, "EVOLUTION_API_KEY é obrigatória").default("G6hJn4M6mEPryjQHpptXAesAdjnbahpW"),
  // Número de teste para alertas (futuramente virá de users.telefone)
  ALERTS_TEST_NUMBER: z.string().min(1).default("5511951474246"),

  // Redis
  REDIS_URL: z.string().url("REDIS_URL deve ser uma URL válida"),

  // Server
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),

  // JWT
  JWT_SECRET: z.string().min(1, "JWT_SECRET é obrigatória").default("change-me-in-production"),

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