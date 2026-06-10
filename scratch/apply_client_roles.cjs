const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

async function applyMigration() {
  const migrationPath = path.join(__dirname, "..", "supabase", "migrations", "20260531100000_client_roles.sql");
  const sql = fs.readFileSync(migrationPath, "utf8");

  // Usar DIRECT_URL para operações DDL (migrations)
  const databaseUrl = "postgresql://postgres.ymigpflksxoxyoydjpqi:Vxgustavoindustrial123@aws-1-us-west-2.pooler.supabase.com:5432/postgres";

  console.log("Conectando ao Supabase...");
  const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 10000 });

  try {
    await client.connect();
    console.log("Conectado. Aplicando migration...");
    await client.query(sql);
    console.log("Migration aplicada com sucesso!");
  } catch (err) {
    console.error("Erro ao aplicar migration:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
