const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function run() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('Arquivo .env.local não encontrado.');
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  // Buscar DIRECT_URL ou DATABASE_URL
  let connectionStringMatch = envContent.match(/DIRECT_URL\s*=\s*["']?([^"'\r\n]+)["']?/);
  if (!connectionStringMatch) {
    connectionStringMatch = envContent.match(/DATABASE_URL\s*=\s*["']?([^"'\r\n]+)["']?/);
  }

  if (!connectionStringMatch) {
    console.error('Nenhuma string de conexão DATABASE_URL ou DIRECT_URL encontrada em .env.local.');
    process.exit(1);
  }

  const connectionString = connectionStringMatch[1].trim();
  console.log('Conectando ao banco de dados Supabase...');

  const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260530130000_team_management_rpcs.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error('Arquivo de migração SQL não encontrado.');
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');

  // Adicionar ssl config se for supabase hospedado para evitar erros de certificado recusado
  const client = new Client({
    connectionString: connectionString,
    ssl: connectionString.includes('supabase.co') || connectionString.includes('supabase.com') ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('Conectado com sucesso. Executando comandos SQL da migração...');
    await client.query(sql);
    console.log('Migração SQL executada com sucesso! RPCs e políticas de segurança criadas.');
  } catch (err) {
    console.error('Erro ao executar migração SQL:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
