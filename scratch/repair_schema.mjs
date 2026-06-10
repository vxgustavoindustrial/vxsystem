
import pg from 'pg';
const { Client } = pg;
const client = new Client('postgresql://postgres.ymigpflksxoxyoydjpqi:Vxgustavoindustrial123@aws-1-us-west-2.pooler.supabase.com:5432/postgres');

async function repair() {
  await client.connect();
  console.log('--- Iniciando Reparo de Permissões ---');
  
  try {
    // 1. Garantir que o schema auth seja acessível pelos roles da API
    await client.query('GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role');
    await client.query('GRANT SELECT ON ALL TABLES IN SCHEMA auth TO anon, authenticated, service_role');
    
    // 2. Garantir que o schema public seja acessível
    await client.query('GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role');
    await client.query('GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role');
    
    // 3. Garantir que as extensões necessárias estejam ativas
    await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    // 4. Corrigir permissão de execução em funções críticas
    await client.query('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role');

    console.log('✅ Permissões e schemas reparados.');

    // 5. Verificar se os usuários ainda existem e estão corretos
    const res = await client.query("SELECT email, aud, role FROM auth.users");
    console.log('Usuários no banco:', res.rows.map(r => r.email));

  } catch (error) {
    console.error('❌ Erro durante o reparo:', error);
  } finally {
    await client.end();
  }
}

repair();
