import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  const dbClient = await pool.connect();
  
  try {
    await dbClient.query('BEGIN');

    // 1. Initialize Base Schema Blueprint (init.sql)
    console.log('⏳ Reading base schema blueprint (init.sql)...');
    const baseSqlPath = path.join(__dirname, 'init.sql');
    if (fs.existsSync(baseSqlPath)) {
      const baseSql = fs.readFileSync(baseSqlPath, 'utf8');
      await dbClient.query(baseSql);
    }

    // 2. Create internal migration tracking table if it doesn't exist
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Scan and execute incremental delta migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    
    if (fs.existsSync(migrationsDir)) {
      // Read all SQL files, sort them alphabetically/chronologically
      const files = fs.readdirSync(migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .sort();

      for (const file of files) {
        // Check if this specific delta update was already run in the past
        const checkRes = await dbClient.query(
          'SELECT 1 FROM schema_migrations WHERE filename = $1', 
          [file]
        );

        if (checkRes.rowCount === 0) {
          console.log(`🚀 Executing delta migration: ${file}...`);
          const migrationSql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
          
          if (migrationSql.trim()) {
            await dbClient.query(migrationSql);
          }
          
          // Document successful execution to prevent double-runs
          await dbClient.query(
            'INSERT INTO schema_migrations (filename) VALUES ($1)', 
            [file]
          );
        }
      }
    }

    await dbClient.query('COMMIT');
    console.log('✅ Database fully updated and incremental migrations successfully processed.');
    process.exit(0);
  } catch (error) {
    await dbClient.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    dbClient.release();
  }
}

runMigration();
