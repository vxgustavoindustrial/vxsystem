
import pg from 'pg';
const { Client } = pg;
const client = new Client('postgresql://postgres.ymigpflksxoxyoydjpqi:Vxgustavoindustrial123@aws-1-us-west-2.pooler.supabase.com:5432/postgres');

async function fix() {
  await client.connect();
  console.log('--- Corrigindo Usuários e Metadados ---');
  
  // Garantir que os usuários não tenham email_change pendente e estejam confirmados
  const queries = [
    {
      email: 'admin@vxindustrial.com',
      pass: 'admin123',
      meta: { full_name: 'Admin VX' }
    },
    {
      email: 'cliente@teste.com',
      pass: 'cliente123',
      meta: { full_name: 'Usuario Cliente' }
    }
  ];

  for (const q of queries) {
    await client.query(`
      UPDATE auth.users 
      SET 
        encrypted_password = crypt($2, gen_salt('bf', 10)),
        email_confirmed_at = now(),
        last_sign_in_at = NULL,
        raw_app_meta_data = '{"provider":"email","providers":["email"]}',
        raw_user_meta_data = $3,
        is_sso_user = false,
        confirmation_token = '',
        email_change_token_new = '',
        recovery_token = '',
        aud = 'authenticated',
        role = 'authenticated'
      WHERE email = $1
    `, [q.email, q.pass, JSON.stringify(q.meta)]);
  }
  
  const check = await client.query("SELECT email, encrypted_password, email_confirmed_at, aud, role FROM auth.users");
  check.rows.forEach(r => {
    console.log(`Email: ${r.email} | Hash: ${r.encrypted_password.substring(0, 10)}... | Aud: ${r.aud} | Role: ${r.role} | Confirmed: ${r.email_confirmed_at}`);
  });

  await client.end();
}

fix();
