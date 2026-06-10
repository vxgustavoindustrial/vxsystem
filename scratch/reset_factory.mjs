
import pg from 'pg';
const { Client } = pg;
const client = new Client('postgresql://postgres.ymigpflksxoxyoydjpqi:Vxgustavoindustrial123@aws-1-us-west-2.pooler.supabase.com:5432/postgres');

async function fix() {
  await client.connect();
  console.log('--- Reseting Users to Factory Defaults ---');
  
  await client.query("DELETE FROM auth.users");
  await client.query("DELETE FROM public.profiles");
  
  const users = [
    {
      email: 'admin@vxindustrial.com',
      pass: 'admin123',
      role: 'admin',
      name: 'Admin VX'
    },
    {
      email: 'cliente@teste.com',
      pass: 'cliente123',
      role: 'client',
      name: 'Usuario Cliente'
    }
  ];

  for (const u of users) {
    const res = await client.query(`
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, 
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data, 
        created_at, updated_at, is_sso_user
      )
      VALUES (
        '00000000-0000-0000-0000-000000000000',
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        $1,
        crypt($2, gen_salt('bf', 10)),
        now(),
        '{"provider":"email","providers":["email"]}',
        $3,
        now(),
        now(),
        false
      ) RETURNING id;
    `, [u.email, u.pass, JSON.stringify({ full_name: u.name, role: u.role })]);

    const userId = res.rows[0].id;
    
    let clientId = null;
    if (u.role === 'client') {
       const cRes = await client.query("INSERT INTO public.clients (name, email, status) VALUES ('Empresa Teste', $1, 'active') RETURNING id", [u.email]);
       clientId = cRes.rows[0].id;
    }

    await client.query(`
      INSERT INTO public.profiles (id, full_name, email, role, is_active, client_id)
      VALUES ($1, $2, $3, $4, true, $5)
      ON CONFLICT (id) DO UPDATE SET
        role = EXCLUDED.role,
        full_name = EXCLUDED.full_name,
        client_id = EXCLUDED.client_id
    `, [userId, u.name, u.email, u.role, clientId]);
    
    console.log(`✅ Criado: ${u.email}`);
  }

  await client.end();
}

fix();
