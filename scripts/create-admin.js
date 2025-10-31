import bcrypt from 'bcryptjs';
import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const adminData = {
  email: 'Admin@mlodgehotel.co.za',
  password: 'Admin@mlodgehotel',
  name: 'Administrator',
  phone: '+27 11 123 4567',
  role: 'admin'
};

async function createAdminUser() {
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

    // Hash password using EXACT same method as backend (bcrypt with 12 rounds)
    console.log('🔐 Hashing password with bcrypt (12 rounds) - same as backend...');
    const hashedPassword = await bcrypt.hash(adminData.password, 12);
    console.log('✅ Password hashed successfully');
    console.log('📋 Hash:', hashedPassword);

    // Check if admin already exists
    const checkQuery = 'SELECT * FROM users WHERE email = $1';
    const checkResult = await client.query(checkQuery, [adminData.email]);

    if (checkResult.rows.length > 0) {
      console.log('⚠️  Admin user already exists');
      console.log('Existing admin:', checkResult.rows[0]);
      
      // Update password with new hash
      const updateQuery = `
        UPDATE users 
        SET password_hash = $1, role = $2, is_active = true, updated_at = NOW()
        WHERE email = $3
        RETURNING id, email, name, role, is_active, created_at
      `;
      const updateResult = await client.query(updateQuery, [
        hashedPassword,
        adminData.role,
        adminData.email
      ]);
      
      console.log('✅ Admin password updated successfully');
      console.log('Updated admin:', updateResult.rows[0]);
    } else {
      // Insert admin user with properly hashed password
      const insertQuery = `
        INSERT INTO users (email, password_hash, name, phone, role, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING id, email, name, phone, role, is_active, created_at
      `;

      const result = await client.query(insertQuery, [
        adminData.email,
        hashedPassword,
        adminData.name,
        adminData.phone,
        adminData.role,
        true
      ]);

      console.log('✅ Admin user created successfully!');
      console.log('\n📋 Admin Details:');
      console.log('━'.repeat(50));
      console.log(`ID:         ${result.rows[0].id}`);
      console.log(`Email:      ${result.rows[0].email}`);
      console.log(`Name:       ${result.rows[0].name}`);
      console.log(`Phone:      ${result.rows[0].phone}`);
      console.log(`Role:       ${result.rows[0].role}`);
      console.log(`Active:     ${result.rows[0].is_active}`);
      console.log(`Created:    ${result.rows[0].created_at}`);
      console.log('━'.repeat(50));
    }

    console.log('\n🔑 Login Credentials:');
    console.log('━'.repeat(50));
    console.log(`Email:      ${adminData.email}`);
    console.log(`Password:   ${adminData.password}`);
    console.log('━'.repeat(50));
    
    // Test password verification
    console.log('\n🔍 Verifying password hash matches...');
    const testResult = await client.query('SELECT password_hash FROM users WHERE email = $1', [adminData.email]);
    const storedHash = testResult.rows[0].password_hash;
    const isValid = await bcrypt.compare(adminData.password, storedHash);
    console.log(isValid ? '✅ Password verification SUCCESSFUL - Login will work!' : '❌ Password verification FAILED');

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    throw error;
  } finally {
    await client.end();
    console.log('\n✅ Database connection closed');
  }
}

// Run the script
createAdminUser()
  .then(() => {
    console.log('\n✨ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });
