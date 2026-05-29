/**
 * Script para criar um usuário admin de teste no Supabase.
 * 
 * Cria o usuário na Auth do Supabase e insere o perfil na tabela profiles.
 * 
 * Uso: node scratch/create_admin.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ymigpflksxoxyoydjpqi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_f9iE5N4ELIxBx3Qy5IX2Eg_qxYaKhS5';

// Credenciais do admin de teste
const ADMIN_EMAIL = 'admin@vxindustrial.com';
const ADMIN_PASSWORD = 'Admin@123456';
const ADMIN_NAME = 'Admin VX (Teste)';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  console.log('🔧 Criando usuário admin de teste...');
  console.log(`   Email: ${ADMIN_EMAIL}`);
  console.log(`   Senha: ${ADMIN_PASSWORD}`);
  console.log('');

  // 1. Criar usuário na Auth do Supabase
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    options: {
      data: {
        full_name: ADMIN_NAME,
      },
      // Não enviar email de confirmação (auto-confirmar se possível)
      emailRedirectTo: undefined,
    },
  });

  if (authError) {
    // Se o usuário já existe, tentar fazer login para pegar o ID
    if (authError.message.includes('already registered') || authError.message.includes('already been registered')) {
      console.log('⚠️  Usuário já existe na Auth. Tentando fazer login...');
      
      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      });

      if (loginError) {
        console.error('❌ Erro ao fazer login:', loginError.message);
        process.exit(1);
      }

      console.log('✅ Login realizado. Verificando perfil...');
      const userId = loginData.user.id;

      // Verificar se já tem perfil
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (existingProfile) {
        if (existingProfile.role === 'admin') {
          console.log('✅ Perfil admin já existe! Nada mais a fazer.');
        } else {
          console.log(`⚠️  Perfil existe mas com role "${existingProfile.role}". Atualizando para admin...`);
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ role: 'admin', full_name: ADMIN_NAME, is_active: true })
            .eq('id', userId);
          
          if (updateError) {
            console.error('❌ Erro ao atualizar perfil:', updateError.message);
          } else {
            console.log('✅ Perfil atualizado para admin!');
          }
        }
      } else {
        // Criar perfil
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            full_name: ADMIN_NAME,
            email: ADMIN_EMAIL,
            role: 'admin',
            is_active: true,
          });

        if (profileError) {
          console.error('❌ Erro ao criar perfil:', profileError.message);
        } else {
          console.log('✅ Perfil admin criado com sucesso!');
        }
      }

      await supabase.auth.signOut();
      printCredentials();
      return;
    }

    console.error('❌ Erro ao criar usuário:', authError.message);
    process.exit(1);
  }

  if (!authData.user) {
    console.error('❌ Nenhum usuário retornado.');
    process.exit(1);
  }

  const userId = authData.user.id;
  console.log(`✅ Usuário criado na Auth! ID: ${userId}`);

  // Verificar se precisa confirmar email
  if (authData.user.identities?.length === 0) {
    console.log('⚠️  Usuário já existe (identities vazia). Tente fazer login.');
    process.exit(1);
  }

  // Fazer login para ter sessão ativa
  const { error: loginError } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });

  if (loginError) {
    console.log('⚠️  Não foi possível fazer login automaticamente.');
    console.log('   O email pode precisar de confirmação no painel do Supabase.');
    console.log(`   Acesse: ${SUPABASE_URL} → Authentication → Users`);
    console.log('   Confirme o email do usuário manualmente.');
    printCredentials();
    process.exit(0);
  }

  // 2. Criar perfil na tabela profiles
  console.log('📝 Criando perfil admin na tabela profiles...');
  
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      full_name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      role: 'admin',
      is_active: true,
    }, { onConflict: 'id' });

  if (profileError) {
    console.error('❌ Erro ao criar perfil:', profileError.message);
    console.log('');
    console.log('💡 Pode ser necessário criar o perfil via SQL no painel do Supabase:');
    console.log(`   INSERT INTO profiles (id, full_name, email, role, is_active)`);
    console.log(`   VALUES ('${userId}', '${ADMIN_NAME}', '${ADMIN_EMAIL}', 'admin', true);`);
  } else {
    console.log('✅ Perfil admin criado com sucesso!');
  }

  await supabase.auth.signOut();
  printCredentials();
}

function printCredentials() {
  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('  🔑 CREDENCIAIS DO ADMIN DE TESTE');
  console.log('═══════════════════════════════════════════');
  console.log(`  📧 Email:  ${ADMIN_EMAIL}`);
  console.log(`  🔒 Senha:  ${ADMIN_PASSWORD}`);
  console.log('═══════════════════════════════════════════');
  console.log('');
  console.log('  Acesse: http://localhost:5173/login');
  console.log('');
}

main().catch((err) => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
