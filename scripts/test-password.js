import bcrypt from 'bcryptjs';
import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';

dotenv.config();

async function testPassword() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'mLodge-Hotel',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Get the stored hash
    const result = await client.query(
      'SELECT password_hash FROM users WHERE email = $1',
      ['Admin@mlodgehotel.co.za']
    );

    if (result.rows.length === 0) {
      console.log('❌ No user found');
      return;
    }

    const storedHash = result.rows[0].password_hash;
    console.log('📋 Stored hash:', storedHash);
    console.log('📋 Hash length:', storedHash.length);

    // Test with different passwords
    const passwords = [
      'Admin@mlodgehotel',
      'Admin@mlodgehotel\r',
      'Admin@mlodgehotel\n',
      'Admin@mlodgehotel ',
      ' Admin@mlodgehotel'
    ];

    for (const pwd of passwords) {
      const match = await bcrypt.compare(pwd, storedHash);
      console.log(`Testing "${pwd}" (length: ${pwd.length}): ${match ? '✅ MATCH' : '❌ NO MATCH'}`);
    }

    // Generate a new hash and compare
    console.log('\n🔐 Generating fresh hash...');
    const freshHash = await bcrypt.hash('Admin@mlodgehotel', 12);
    console.log('📋 Fresh hash:', freshHash);
    const freshMatch = await bcrypt.compare('Admin@mlodgehotel', freshHash);
    console.log(`Fresh hash matches: ${freshMatch ? '✅ YES' : '❌ NO'}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

testPassword();
