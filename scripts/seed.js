import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { query } from '../src/config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Seed tracker table
const createSeedsTable = `
  CREATE TABLE IF NOT EXISTS seeds (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL UNIQUE,
    executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`;

// List of seed files in order
const seeds = [
  'sample_data.sql',
  // Add more seed files here as needed
];

async function runSeeds() {
  console.log('🌱 Starting database seeding...\n');

  try {
    // Create seeds table if it doesn't exist
    await query(createSeedsTable);
    console.log('✅ Seeds table ready');

    // Check which seeds have already been run
    const executedResult = await query('SELECT filename FROM seeds ORDER BY id');
    const executedSeeds = executedResult.rows.map(row => row.filename);

    let seedsRun = 0;

    for (const seedFile of seeds) {
      if (executedSeeds.includes(seedFile)) {
        console.log(`⏭️  Skipping ${seedFile} (already executed)`);
        continue;
      }

      console.log(`🔄 Running seed: ${seedFile}`);

      try {
        // Read seed file
        const seedPath = join(__dirname, '..', 'seeds', seedFile);
        const seedSQL = await readFile(seedPath, 'utf-8');

        // Execute seed
        await query(seedSQL);

        // Record seed as executed
        await query(
          'INSERT INTO seeds (filename) VALUES ($1)',
          [seedFile]
        );

        console.log(`✅ Completed seed: ${seedFile}`);
        seedsRun++;
      } catch (error) {
        console.error(`❌ Error running seed ${seedFile}:`, error);
        throw error;
      }
    }

    console.log(`\n🎉 Seeding complete! ${seedsRun} new seeds executed.`);
  } catch (error) {
    console.error('💥 Seeding failed:', error);
    process.exit(1);
  }
}

// Function to reset database (for development)
async function resetDatabase() {
  console.log('🔥 Resetting database...\n');
  
  const shouldReset = process.argv.includes('--force') || process.env.NODE_ENV === 'development';
  
  if (!shouldReset) {
    console.log('❌ Database reset requires --force flag or development environment');
    return;
  }

  try {
    // Drop all tables (in reverse dependency order)
    const dropTables = `
      DROP TABLE IF EXISTS seeds CASCADE;
      DROP TABLE IF EXISTS migrations CASCADE;
      DROP TABLE IF EXISTS audit_logs CASCADE;
      DROP TABLE IF EXISTS notifications CASCADE;
      DROP TABLE IF EXISTS reviews CASCADE;
      DROP TABLE IF EXISTS room_inventory CASCADE;
      DROP TABLE IF EXISTS payments CASCADE;
      DROP TABLE IF EXISTS booking_items CASCADE;
      DROP TABLE IF EXISTS bookings CASCADE;
      DROP TABLE IF EXISTS rooms CASCADE;
      DROP TABLE IF EXISTS accommodations CASCADE;
      DROP TABLE IF EXISTS password_reset_tokens CASCADE;
      DROP TABLE IF EXISTS oauth_providers CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      
      -- Drop the update function as well
      DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
    `;

    await query(dropTables);
    console.log('✅ Database tables dropped');

    // Re-run migrations and seeds
    const runMigrations = (await import('./migrate.js')).default;
    await runMigrations();
    await runSeeds();

    console.log('\n🎉 Database reset complete!');
  } catch (error) {
    console.error('💥 Database reset failed:', error);
    process.exit(1);
  }
}

// Handle command line arguments
if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes('--reset')) {
    resetDatabase();
  } else {
    runSeeds();
  }
}

export { runSeeds, resetDatabase };
export default runSeeds;