
import pg from 'pg';
const { Client } = pg;
const client = new Client('postgresql://postgres.ymigpflksxoxyoydjpqi:Vxgustavoindustrial123@aws-1-us-west-2.pooler.supabase.com:5432/postgres');

async function check() {
  await client.connect();
  const res = await client.query("SELECT prosrc FROM pg_proc WHERE proname = 'handle_new_user'");
  console.log(res.rows[0].prosrc);
  await client.end();
}
check();
