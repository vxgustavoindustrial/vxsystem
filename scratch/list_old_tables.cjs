const { Client } = require('pg');

const oldConnectionString = "postgresql://postgres:HJ190924011503@db.xzzqbkpawgzrgxgpddkg.supabase.co:5432/postgres";

async function main() {
  const client = new Client({
    connectionString: oldConnectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Conectado com sucesso ao banco antigo!");

    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log("Tabelas encontradas:");
    for (const row of res.rows) {
      const countRes = await client.query(`SELECT COUNT(*) FROM "${row.table_name}"`).catch(() => ({ rows: [{ count: 'N/A' }] }));
      console.log(`- ${row.table_name}: ${countRes.rows[0].count} linhas`);
    }

  } catch (err) {
    console.error("Erro:", err);
  } finally {
    await client.end();
  }
}

main();
