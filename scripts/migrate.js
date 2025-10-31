import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { query } from '../src/config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Migration tracker table
const createMigrationsTable = `
  CREATE TABLE IF NOT EXISTS migrations (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL UNIQUE,
    executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`;

// List of migration files in order
const migrations = [
  '001_initial_schema.sql',
  // Add more migration files here as needed
];

async function runMigrations() {
  console.log('🚀 Starting database migrations...\n');

  try {
    // Create migrations table if it doesn't exist
    await query(createMigrationsTable);
    console.log('✅ Migrations table ready');

    // Check which migrations have already been run
    const executedResult = await query('SELECT filename FROM migrations ORDER BY id');
    const executedMigrations = executedResult.rows.map(row => row.filename);

    let migrationsRun = 0;

    for (const migrationFile of migrations) {
      if (executedMigrations.includes(migrationFile)) {
        console.log(`⏭️  Skipping ${migrationFile} (already executed)`);
        continue;
      }

      console.log(`🔄 Running migration: ${migrationFile}`);

      try {
        // Read migration file
        const migrationPath = join(__dirname, '..', 'migrations', migrationFile);
        const migrationSQL = await readFile(migrationPath, 'utf-8');

        // Execute migration
        await query(migrationSQL);

        // Record migration as executed
        await query(
          'INSERT INTO migrations (filename) VALUES ($1)',
          [migrationFile]
        );

        console.log(`✅ Completed migration: ${migrationFile}`);
        migrationsRun++;
      } catch (error) {
        console.error(`❌ Error running migration ${migrationFile}:`, error);
        throw error;
      }
    }

    console.log(`\n🎉 Migration complete! ${migrationsRun} new migrations executed.`);
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations();
}

export default runMigrations;