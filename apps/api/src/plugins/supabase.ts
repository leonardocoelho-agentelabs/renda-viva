import { createClient } from "@supabase/supabase-js";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import ws from "ws";
import { env } from "../env.js";

// Cliente Supabase com service_role (bypassa RLS)
export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    realtime: {
      transport: ws,
    },
  }
);

async function supabasePlugin(fastify: FastifyInstance) {
  // Decorar fastify com o cliente admin
  fastify.decorate("supabaseAdmin", supabaseAdmin);

  fastify.log.info("✅ Plugin Supabase (service_role) carregado");
}

export default fp(supabasePlugin, {
  name: "supabase",
});

// Extensão de tipos do Fastify
declare module "fastify" {
  interface FastifyInstance {
    supabaseAdmin: typeof supabaseAdmin;
  }
}