/**
 * Script para confirmar email e criar perfil admin via conexão direta ao banco.
 */

import pg from 'pg';

const DATABASE_URL = 'postgresql://postgres.ymigpflksxoxyoydjpqi:Vxgustavoindustrial123@aws-1-us-west-2.pooler.supabase.com:5432/postgres';
const USER_ID = '7c427f73-cf97-4f75-9572-36e587acc75c';
const ADMIN_EMAIL = 'admin@vxindustrial.com';
const ADMIN_NAME = 'Admin VX (Teste)';

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  
  try {
    console.log('🔌 Conectando ao banco de dados...');
    await client.connect();
    console.log('✅ Conectado!');

    // 1. Confirmar email do usuário na Auth
    console.log('📧 Confirmando email do usuário...');
    const confirmResult = await client.query(`
      UPDATE auth.users 
      SET email_confirmed_at = NOW(),
          confirmation_token = '',
          raw_app_meta_data = raw_app_meta_data || '{"provider": "email", "providers": ["email"]}'::jsonb
      WHERE id = $1
    `, [USER_ID]);
    console.log(`✅ Email confirmado! (${confirmResult.rowCount} registro(s) atualizado(s))`);

    // 2. Verificar se perfil já existe
    console.log('👤 Verificando perfil...');
    const profileCheck = await client.query(
      'SELECT id, role FROM public.profiles WHERE id = $1',
      [USER_ID]
    );

    if (profileCheck.rows.length > 0) {
      console.log(`✅ Perfil já existe com role: "${profileCheck.rows[0].role}"`);
      if (profileCheck.rows[0].role !== 'admin') {
        await client.query(
          `UPDATE public.profiles SET role = 'admin', is_active = true WHERE id = $1`,
          [USER_ID]
        );
        console.log('✅ Role atualizada para admin!');
      }
    } else {
      // 3. Criar perfil admin
      console.log('📝 Criando perfil admin...');
      await client.query(`
        INSERT INTO public.profiles (id, full_name, email, role, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, 'admin', true, NOW(), NOW())
      `, [USER_ID, ADMIN_NAME, ADMIN_EMAIL]);
      console.log('✅ Perfil admin criado!');
    }

    // 4. Verificação final
    const verify = await client.query(`
      SELECT 
        u.email, 
        u.email_confirmed_at,
        p.full_name,
        p.role,
        p.is_active
      FROM auth.users u 
      LEFT JOIN public.profiles p ON p.id = u.id
      WHERE u.id = $1
    `, [USER_ID]);

    if (verify.rows.length > 0) {
      const row = verify.rows[0];
      console.log('');
      console.log('═══════════════════════════════════════════');
      console.log('  ✅ USUÁRIO ADMIN PRONTO PARA USO!');
      console.log('═══════════════════════════════════════════');
      console.log(`  📧 Email:      ${row.email}`);
      console.log(`  🔒 Senha:      Admin@123456`);
      console.log(`  👤 Nome:       ${row.full_name}`);
      console.log(`  🛡️  Role:       ${row.role}`);
      console.log(`  ✅ Ativo:      ${row.is_active}`);
      console.log(`  📧 Confirmado: ${row.email_confirmed_at ? 'Sim' : 'Não'}`);
      console.log('═══════════════════════════════════════════');
      console.log('');
      console.log('  Acesse: http://localhost:5173/login');
      console.log('');
    }

  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
