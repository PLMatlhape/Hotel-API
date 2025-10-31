-- Create Admin User for mLodge Hotel
-- Email: Admin@mlodgehotel.co.za
-- Password: Admin@mlodgehotel

-- Note: The password hash below was generated using bcryptjs with 12 salt rounds
-- The hash corresponds to the password: Admin@mlodgehotel

-- First, check if admin exists and delete if needed (optional - uncomment if you want to recreate)
-- DELETE FROM users WHERE email = 'Admin@mlodgehotel.co.za';

-- Insert admin user with hashed password
INSERT INTO users (
  email, 
  password_hash, 
  name, 
  phone, 
  role, 
  created_at, 
  updated_at
)
VALUES (
  'Admin@mlodgehotel.co.za',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5eo5HkQw8mi5e', -- Hash for: Admin@mlodgehotel
  'Administrator',
  '+27 11 123 4567',
  'admin',
  NOW(),
  NOW()
)
ON CONFLICT (email) 
DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  updated_at = NOW()
RETURNING id, email, name, role, created_at;

-- Verify the admin was created
SELECT 
  id,
  email,
  name,
  phone,
  role,
  created_at,
  updated_at
FROM users 
WHERE email = 'Admin@mlodgehotel.co.za';
