
import pg from 'pg';
const { Client } = pg;

const client = new Client('postgresql://postgres.ymigpflksxoxyoydjpqi:Vxgustavoindustrial123@aws-1-us-west-2.pooler.supabase.com:5432/postgres');

async function run() {
  await client.connect();

  try {
    console.log('--- Iniciando Limpeza Geral ---');
    
    // Desabilitar triggers temporariamente se necessário para limpeza em cascata
    // Mas auth.users deleta profiles se houver FK com ON DELETE CASCADE
    await client.query('DELETE FROM public.profiles');
    await client.query('DELETE FROM auth.users');
    await client.query('DELETE FROM public.clients'); // Limpa clientes antigos também
    
    console.log('✅ Todos os usuários e clientes antigos removidos.');

    // 1. Criar Admin
    const adminEmail = 'admin@vxindustrial.com';
    const adminPass = 'admin123';
    
    // Deletar qualquer resquício anterior para garantir
    await client.query('DELETE FROM auth.users WHERE email = $1', [adminEmail]);

    const adminRes = await client.query(`
      INSERT INTO auth.users (
        id, aud, role, email, encrypted_password, email_confirmed_at, 
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token,
        is_sso_user, email_change_token_new, recovery_token
      )
      VALUES (
        gen_random_uuid(), 'authenticated', 'authenticated', $1, crypt($2, gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', '{"full_name":"Admin VX"}', now(), now(), '',
        false, '', ''
      ) RETURNING id;
    `, [adminEmail, adminPass]);
    
    const adminId = adminRes.rows[0].id;
    await client.query(`
      INSERT INTO public.profiles (id, full_name, email, role, is_active)
      VALUES ($1, 'Admin VX', $2, 'admin', true)
      ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        is_active = EXCLUDED.is_active
    `, [adminId, adminEmail]);
    
    console.log('🚀 Admin criado: admin@vxindustrial.com / admin123');

    // 2. Criar Cliente
    const clientName = 'Empresa de Teste';
    const clientEmail = 'cliente@teste.com';
    const clientPass = 'cliente123';

    // Deletar qualquer resquício anterior para garantir
    await client.query('DELETE FROM auth.users WHERE email = $1', [clientEmail]);

    const clientOrgRes = await client.query(`
      INSERT INTO public.clients (name, email, status)
      VALUES ($1, $2, 'active')
      RETURNING id;
    `, [clientName, clientEmail]);
    
    const orgId = clientOrgRes.rows[0].id;

    const clientUserRes = await client.query(`
      INSERT INTO auth.users (
        id, aud, role, email, encrypted_password, email_confirmed_at, 
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token,
        is_sso_user, email_change_token_new, recovery_token
      )
      VALUES (
        gen_random_uuid(), 'authenticated', 'authenticated', $1, crypt($2, gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', '{"full_name":"Usuario Cliente"}', now(), now(), '',
        false, '', ''
      ) RETURNING id;
    `, [clientEmail, clientPass]);

    const clientUserId = clientUserRes.rows[0].id;
    await client.query(`
      INSERT INTO public.profiles (id, full_name, email, role, is_active, client_id)
      VALUES ($1, 'Usuario Cliente', $2, 'client', true, $3)
      ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        is_active = EXCLUDED.is_active,
        client_id = EXCLUDED.client_id
    `, [clientUserId, clientEmail, orgId]);

    console.log('🚀 Cliente criado: cliente@teste.com / cliente123');

  } catch (error) {
    console.error('❌ Erro durante a operação:', error);
  } finally {
    await client.end();
  }
}

run();
