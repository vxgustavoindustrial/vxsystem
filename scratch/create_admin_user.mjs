/**
 * Script para criar um usuário admin de teste no Supabase.
 * 
 * Usa a Supabase Management API para criar o usuário via Auth Admin.
 * 
 * Requer: SUPABASE_SERVICE_ROLE_KEY como variável de ambiente ou como argumento.
 * 
 * Usage: node create_admin_user.mjs <service_role_key>
 */

const SUPABASE_URL = 'https://ymigpflksxoxyoydjpqi.supabase.co';

// Dados do usuário admin de teste
const ADMIN_EMAIL = 'admin.teste@vxindustrial.com';
const ADMIN_PASSWORD = 'Admin@Teste2026!';
const ADMIN_NAME = 'Admin Teste';

async function main() {
  const serviceRoleKey = process.argv[2] || process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!serviceRoleKey) {
    console.error('❌ Service Role Key não fornecida.');
    console.error('   Usage: node create_admin_user.mjs <service_role_key>');
    process.exit(1);
  }

  console.log('🔐 Criando usuário admin de teste...');
  console.log(`   Email: ${ADMIN_EMAIL}`);
  console.log(`   Nome: ${ADMIN_NAME}`);

  // 1. Criar o usuário no Auth do Supabase
  console.log('\n📝 Passo 1: Criando usuário no Supabase Auth...');
  
  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true, // Confirmar email automaticamente
      user_metadata: {
        full_name: ADMIN_NAME,
      },
    }),
  });

  const authData = await authRes.json();

  if (!authRes.ok) {
    console.error('❌ Erro ao criar usuário no Auth:', JSON.stringify(authData, null, 2));
    // Se o usuário já existe, tentar buscar pelo email
    if (authData.msg?.includes('already') || authData.message?.includes('already')) {
      console.log('\n⚠️  Usuário já existe. Tentando buscar o ID...');
      
      const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=50`, {
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
      });
      const listData = await listRes.json();
      const existingUser = listData.users?.find(u => u.email === ADMIN_EMAIL);
      
      if (existingUser) {
        console.log(`✅ Usuário encontrado! ID: ${existingUser.id}`);
        await ensureProfile(serviceRoleKey, existingUser.id);
        return;
      }
    }
    process.exit(1);
  }

  const userId = authData.id;
  console.log(`✅ Usuário criado! ID: ${userId}`);

  // 2. Criar/atualizar o perfil na tabela profiles
  await ensureProfile(serviceRoleKey, userId);
}

async function ensureProfile(serviceRoleKey, userId) {
  console.log('\n📝 Passo 2: Criando perfil admin na tabela profiles...');

  // Usando a REST API do PostgREST (Supabase)
  const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      id: userId,
      email: ADMIN_EMAIL,
      full_name: ADMIN_NAME,
      role: 'admin',
    }),
  });

  if (!profileRes.ok) {
    const errText = await profileRes.text();
    console.error('❌ Erro ao criar perfil:', errText);
    
    // Tentar com PATCH (update)
    console.log('\n🔄 Tentando atualizar perfil existente...');
    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        email: ADMIN_EMAIL,
        full_name: ADMIN_NAME,
        role: 'admin',
      }),
    });

    if (!patchRes.ok) {
      const patchErr = await patchRes.text();
      console.error('❌ Erro ao atualizar perfil:', patchErr);
      process.exit(1);
    }
    console.log('✅ Perfil atualizado com role admin!');
  } else {
    console.log('✅ Perfil admin criado com sucesso!');
  }

  console.log('\n' + '='.repeat(50));
  console.log('🎉 USUÁRIO ADMIN CRIADO COM SUCESSO!');
  console.log('='.repeat(50));
  console.log(`   📧 Email:    ${ADMIN_EMAIL}`);
  console.log(`   🔑 Senha:    ${ADMIN_PASSWORD}`);
  console.log(`   👤 Nome:     ${ADMIN_NAME}`);
  console.log(`   🛡️  Role:     admin`);
  console.log(`   🆔 ID:       ${userId}`);
  console.log('='.repeat(50));
}

main().catch(err => {
  console.error('❌ Erro inesperado:', err);
  process.exit(1);
});
