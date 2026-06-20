/**
 * Script para forçar exclusão completa de um usuário específico
 * Útil para corrigir contas em estado inconsistente
 *
 * Uso:
 *   npx tsx scripts/force-delete-user.ts <user_id> <supabase_url> <service_role_key>
 *
 * Exemplo:
 *   npx tsx scripts/force-delete-user.ts \
 *     ae779260-0f5e-4e70-8050-76f642276920 \
 *     https://lefncllcrnbcclqgysyt.supabase.co \
 *     eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 */

import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

const userId = process.argv[2]
const supabaseUrl = process.argv[3]
const serviceRoleKey = process.argv[4]

if (!userId || !supabaseUrl || !serviceRoleKey) {
  console.error('❌ Uso: npx tsx scripts/force-delete-user.ts <user_id> <supabase_url> <service_role_key>')
  console.error('')
  console.error('Para obter a service_role_key:')
  console.error('  Supabase Dashboard > Project Settings > API > service_role secret')
  process.exit(1)
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  realtime: {
    transport: ws,
  },
})

// Tabelas que referenciam auth.users(id) via CASCADE
const authTables = [
  'recurring_commitments',
  'viva_memory',
  'conversation_history',
  'mentor_objectives',
  'financial_diagnostics',
  'simulations',
  'calendar_events',
  'leaks_analysis',
  'ir_reports',
]

// Tabelas que referenciam public.users(id) via CASCADE
const publicTables = [
  'transactions',
  'budgets',
  'goals',
  'uploads',
  'forecasts',
  'bank_connections',
  'user_corrections',
  'whatsapp_contacts',
  'subscriptions',
  'pluggY_transactions',
  'pluggY_accounts',
]

async function forceDelete() {
  console.log(`\n🔴 FORCE DELETE - User ID: ${userId}`)
  console.log('='.repeat(50))

  // 1. Verificar se o usuário existe no Auth
  const { data: authUser, error: authFetchError } = await supabaseAdmin.auth.admin.getUserById(userId)

  if (authFetchError || !authUser.user) {
    console.log('⚠️  Usuário não encontrado no Auth (pode já ter sido deletado)')
  } else {
    console.log(`📧 Email: ${authUser.user.email}`)
  }

  // 2. Deletar dados das tabelas que referenciam auth.users (CASCADE deveria cuidar, mas vamos garantir)
  console.log('\n🗑️  Removendo dados de tabelas (auth.users references)...')
  for (const tabela of authTables) {
    try {
      const { error, count } = await supabaseAdmin
        .from(tabela)
        .delete({ count: 'exact' })
        .eq('user_id', userId)

      if (error) {
        console.log(`   ${tabela}: ⚠️  ERRO - ${error.message}`)
      } else {
        console.log(`   ${tabela}: ✅ ${count ?? 0} removidos`)
      }
    } catch (e: any) {
      console.log(`   ${tabela}: ⚠️  EXCEÇÃO - ${e.message}`)
    }
  }

  // 3. Deletar dados das tabelas que referenciam public.users
  console.log('\n🗑️  Removendo dados de tabelas (public.users references)...')
  for (const tabela of publicTables) {
    try {
      const { error, count } = await supabaseAdmin
        .from(tabela)
        .delete({ count: 'exact' })
        .eq('user_id', userId)

      if (error) {
        console.log(`   ${tabela}: ⚠️  ERRO - ${error.message}`)
      } else {
        console.log(`   ${tabela}: ✅ ${count ?? 0} removidos`)
      }
    } catch (e: any) {
      console.log(`   ${tabela}: ⚠️  EXCEÇÃO - ${e.message}`)
    }
  }

  // 4. Deletar de public.users (se existir)
  console.log('\n🗑️  Removendo de public.users...')
  const { error: publicUserError } = await supabaseAdmin
    .from('users')
    .delete()
    .eq('id', userId)

  if (publicUserError) {
    console.log(`   public.users: ⚠️  ERRO - ${publicUserError.message}`)
  } else {
    console.log(`   public.users: ✅ removido`)
  }

  // 5. Por último, deletar do Auth (CRÍTICO)
  console.log('\n🔥 Removendo usuário do Auth (SUPABASE AUTH)...')
  const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

  if (authDeleteError) {
    console.log(`   auth.users: ❌ ERRO - ${authDeleteError.message}`)
    console.log('\n❌ FALHA NA EXCLUSÃO - Execute novamente ou verifique manualmente')
    process.exit(1)
  } else {
    console.log(`   auth.users: ✅ DELETADO COM SUCESSO`)
  }

  console.log('\n' + '='.repeat(50))
  console.log('✅ EXCLUSÃO COMPLETA FINALIZADA COM SUCESSO')
  console.log('='.repeat(50) + '\n')
}

forceDelete().catch((e) => {
  console.error('\n❌ ERRO INESPERADO:', e)
  process.exit(1)
})
