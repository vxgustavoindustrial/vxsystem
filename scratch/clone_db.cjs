const { Client } = require('pg');

const oldConnectionString = "postgresql://postgres:HJ190924011503@db.xzzqbkpawgzrgxgpddkg.supabase.co:5432/postgres";
const newConnectionString = "postgresql://postgres.ymigpflksxoxyoydjpqi:Vxgustavoindustrial123@aws-1-us-west-2.pooler.supabase.com:5432/postgres";

async function main() {
  const oldClient = new Client({
    connectionString: oldConnectionString,
    ssl: { rejectUnauthorized: false }
  });

  const newClient = new Client({
    connectionString: newConnectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await oldClient.connect();
    console.log("Conectado ao banco antigo.");
    await newClient.connect();
    console.log("Conectado ao banco novo.");

    // 1. Obter todas as tabelas
    const tablesRes = await oldClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    const tables = tablesRes.rows.map(r => r.table_name);
    console.log("Tabelas para clonar:", tables);

    // Desabilitar triggers temporariamente no novo banco para evitar RLS e FKs
    await newClient.query("SET session_replication_role = 'replica';").catch(e => console.warn("Aviso ao setar replica:", e.message));

    // Para cada tabela, criamos a estrutura e copiamos os dados
    for (const table of tables) {
      console.log(`\nProcessando tabela: ${table}`);

      // Deletar a tabela se já foi criada incorretamente para recriá-la limpa
      await newClient.query(`DROP TABLE IF EXISTS "${table}" CASCADE;`);

      // Obter colunas e udt_name para precisão de tipos (ex: arrays)
      const colsRes = await oldClient.query(`
        SELECT column_name, data_type, character_maximum_length, column_default, is_nullable, udt_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [table]);

      // Gerar DDL de criação de colunas
      const colDefs = colsRes.rows.map(col => {
        let def = `"${col.column_name}" `;
        
        let type = col.data_type;
        if (type === 'ARRAY') {
          // Usar o udt_name (ex: _text -> text[], _uuid -> uuid[])
          const elemType = col.udt_name.startsWith('_') ? col.udt_name.substring(1) : col.udt_name;
          def += `${elemType}[]`;
        } else if (type === 'user-defined') {
          // Preservar tipo do usuário se possível, ou fallback para text
          def += col.udt_name;
        } else if (type === 'numeric') {
          def += 'numeric(12,2)';
        } else {
          def += type;
        }

        // Adicionar valor padrão se existir e não for nextval
        if (col.column_default) {
          if (!col.column_default.includes('nextval')) {
            def += ` DEFAULT ${col.column_default}`;
          }
        }

        // Nullability
        if (col.is_nullable === 'NO') {
          def += ' NOT NULL';
        }

        return def;
      });

      // Adicionar Primary Key se houver
      const pkRes = await oldClient.query(`
        SELECT c.column_name
        FROM information_schema.table_constraints tc 
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage c
          ON c.constraint_name = tc.constraint_name
          AND c.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_name = $1;
      `, [table]);

      if (pkRes.rows.length > 0) {
        const pkCols = pkRes.rows.map(r => `"${r.column_name}"`).join(', ');
        colDefs.push(`PRIMARY KEY (${pkCols})`);
      }

      const createSql = `CREATE TABLE IF NOT EXISTS "${table}" (\n  ${colDefs.join(',\n  ')}\n);`;
      console.log(`Criando tabela ${table}...`);
      await newClient.query(createSql);

      // Copiar dados
      const dataRes = await oldClient.query(`SELECT * FROM "${table}"`);
      console.log(`Tabela ${table} possui ${dataRes.rows.length} registros. Inserindo no novo banco...`);

      if (dataRes.rows.length > 0) {
        const columns = colsRes.rows.map(r => `"${r.column_name}"`).join(', ');
        
        for (const row of dataRes.rows) {
          const placeholders = colsRes.rows.map((_, idx) => `$${idx + 1}`).join(', ');
          
          const values = colsRes.rows.map(col => {
            const val = row[col.column_name];
            
            // Se for do tipo JSONB ou JSON e for um objeto/array, precisamos serializar para string
            if (val !== null && typeof val === 'object' && (col.data_type === 'jsonb' || col.data_type === 'json')) {
              return JSON.stringify(val);
            }
            
            return val;
          });
          
          const insertSql = `INSERT INTO "${table}" (${columns}) VALUES (${placeholders}) ON CONFLICT DO NOTHING;`;
          await newClient.query(insertSql, values).catch(e => {
            console.error(`Erro ao inserir na tabela ${table}:`, e.message);
          });
        }
      }
    }

    // Reabilitar triggers
    await newClient.query("SET session_replication_role = 'origin';").catch(e => console.warn("Aviso ao restaurar origin:", e.message));
    console.log("\nBanco de dados clonado com sucesso!");

  } catch (err) {
    console.error("Erro fatal durante a clonagem:", err);
  } finally {
    await oldClient.end();
    await newClient.end();
  }
}

main();
