import bcrypt from 'bcryptjs';
import { query } from '../config/database.js';
import { User, OAuthProvider } from '../types/index.js';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt.js';
import { AppError } from '../middleware/errorHandler.js';

// =============================================
// USER REGISTRATION
// =============================================
export const registerUser = async (
  email: string,
  name: string,
  password: string,
  phone?: string,
  role?: string
): Promise<{ user: User; accessToken: string; refreshToken: string }> => {
  // Check if user already exists
  const existingUser = await query(
    'SELECT id FROM users WHERE email = $1',
    [email]
  );

  if (existingUser.rows.length > 0) {
    throw new AppError('User with this email already exists', 409);
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);

  // Insert user into database
  const result = await query(
    `INSERT INTO users (email, name, password_hash, phone, role, is_active)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, email, name, phone, role, created_at, updated_at, is_active`,
    [email, name, hashedPassword, phone || null, role || 'user', true]
  );

  const user = result.rows[0];

  // Generate tokens
  const accessToken = generateAccessToken({
    id: user.id,
    email: user.email,
    role: user.role,
  });

  const refreshToken = generateRefreshToken({
    id: user.id,
    email: user.email,
    role: user.role,
  });

  return { user, accessToken, refreshToken };
};

// =============================================
// USER LOGIN
// =============================================
export const loginUser = async (
  email: string,
  password: string
): Promise<{ user: User; accessToken: string; refreshToken: string }> => {
  // Find user by email
  const result = await query(
    `SELECT id, email, name, phone, password_hash, role, created_at, updated_at, is_active
     FROM users
     WHERE email = $1`,
    [email]
  );

  if (result.rows.length === 0) {
    throw new AppError('Invalid email or password', 401);
  }

  const user = result.rows[0];

  // Check if user is active
  if (!user.is_active) {
    throw new AppError('Your account has been deactivated', 403);
  }

  // Check if password exists (OAuth users might not have password)
  if (!user.password_hash) {
    throw new AppError('Please log in using OAuth provider', 401);
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);

  if (!isPasswordValid) {
    throw new AppError('Invalid email or password', 401);
  }

  // Remove password from user object
  delete user.password_hash;

  // Generate tokens
  const accessToken = generateAccessToken({
    id: user.id,
    email: user.email,
    role: user.role,
  });

  const refreshToken = generateRefreshToken({
    id: user.id,
    email: user.email,
    role: user.role,
  });

  return { user, accessToken, refreshToken };
};

// =============================================
// OAUTH AUTHENTICATION
// =============================================
export const oauthLogin = async (
  provider: string,
  providerUserId: string,
  email: string,
  name: string
): Promise<{ user: User; accessToken: string; refreshToken: string; isNewUser: boolean }> => {
  // Check if OAuth provider record exists
  const oauthResult = await query(
    'SELECT user_id FROM oauth_providers WHERE provider = $1 AND provider_user_id = $2',
    [provider, providerUserId]
  );

  let userId: string;
  let isNewUser = false;

  if (oauthResult.rows.length > 0) {
    // Existing OAuth user
    userId = oauthResult.rows[0].user_id;
  } else {
    // Check if user exists by email
    const userResult = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length > 0) {
      // User exists, link OAuth provider
      userId = userResult.rows[0].id;
    } else {
      // Create new user
      const newUserResult = await query(
        `INSERT INTO users (email, name, role, is_active)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [email, name, 'user', true]
      );
      userId = newUserResult.rows[0].id;
      isNewUser = true;
    }

    // Create OAuth provider record
    await query(
      `INSERT INTO oauth_providers (user_id, provider, provider_user_id)
       VALUES ($1, $2, $3)`,
      [userId, provider, providerUserId]
    );
  }

  // Get user details
  const userResult = await query(
    `SELECT id, email, name, phone, role, created_at, updated_at, is_active
     FROM users
     WHERE id = $1`,
    [userId]
  );

  const user = userResult.rows[0];

  // Generate tokens
  const accessToken = generateAccessToken({
    id: user.id,
    email: user.email,
    role: user.role,
  });

  const refreshToken = generateRefreshToken({
    id: user.id,
    email: user.email,
    role: user.role,
  });

  return { user, accessToken, refreshToken, isNewUser };
};

// =============================================
// GET USER BY ID
// =============================================
export const getUserById = async (userId: string): Promise<User | null> => {
  const result = await query(
    `SELECT id, email, name, phone, role, created_at, updated_at, is_active
     FROM users
     WHERE id = $1`,
    [userId]
  );

  return result.rows.length > 0 ? result.rows[0] : null;
};

// =============================================
// GET USER BY ID WITH PASSWORD
// =============================================
export const getUserByIdWithPassword = async (userId: string): Promise<User | null> => {
  const result = await query(
    `SELECT id, email, name, phone, password_hash, role, created_at, updated_at, is_active
     FROM users
     WHERE id = $1`,
    [userId]
  );

  return result.rows.length > 0 ? result.rows[0] : null;
};

// =============================================
// UPDATE USER PROFILE
// =============================================
export const updateUserProfile = async (
  userId: string,
  updates: { name?: string; phone?: string }
): Promise<User | null> => {
  const { name, phone } = updates;

  // Build dynamic query
  const updateFields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (name !== undefined) {
    updateFields.push(`name = $${paramIndex++}`);
    values.push(name);
  }

  if (phone !== undefined) {
    updateFields.push(`phone = $${paramIndex++}`);
    values.push(phone);
  }

  if (updateFields.length === 0) {
    throw new AppError('No valid fields to update', 400);
  }

  // Add updated_at timestamp
  updateFields.push(`updated_at = NOW()`);

  // Add user ID to values
  values.push(userId);

  const queryText = `
    UPDATE users
    SET ${updateFields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING id, email, name, phone, role, created_at, updated_at, is_active
  `;

  const result = await query(queryText, values);

  return result.rows.length > 0 ? result.rows[0] : null;
};

// =============================================
// UPDATE USER PASSWORD
// =============================================
export const updateUserPassword = async (
  userId: string,
  hashedPassword: string
): Promise<User | null> => {
  const result = await query(
    `UPDATE users
     SET password_hash = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id, email, name, phone, role, created_at, updated_at, is_active`,
    [hashedPassword, userId]
  );

  return result.rows.length > 0 ? result.rows[0] : null;
};

// =============================================
// UPDATE USER BY ADMIN
// =============================================
export const updateUserByAdmin = async (
  userId: string,
  updates: { name?: string; email?: string; phone?: string }
): Promise<User | null> => {
  const { name, email, phone } = updates;

  // Check if email is being updated and if it's already taken by another user
  if (email) {
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1 AND id != $2',
      [email, userId]
    );
    if (existingUser.rows.length > 0) {
      throw new AppError('Email is already in use by another user', 409);
    }
  }

  // Build dynamic query
  const updateFields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (name !== undefined) {
    updateFields.push(`name = $${paramIndex++}`);
    values.push(name);
  }

  if (email !== undefined) {
    updateFields.push(`email = $${paramIndex++}`);
    values.push(email);
  }

  if (phone !== undefined) {
    updateFields.push(`phone = $${paramIndex++}`);
    values.push(phone);
  }

  if (updateFields.length === 0) {
    throw new AppError('No valid fields to update', 400);
  }

  // Add updated_at timestamp
  updateFields.push(`updated_at = NOW()`);

  // Add user ID to values
  values.push(userId);

  const queryText = `
    UPDATE users
    SET ${updateFields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING id, email, name, phone, role, created_at, updated_at, is_active
  `;

  const result = await query(queryText, values);

  return result.rows.length > 0 ? result.rows[0] : null;
};

// =============================================
// DELETE USER ACCOUNT
// =============================================
export const deleteUserAccount = async (userId: string): Promise<User | null> => {
  const result = await query(
    `DELETE FROM users
     WHERE id = $1
     RETURNING id, email, name, phone, role, created_at, updated_at, is_active`,
    [userId]
  );

  return result.rows.length > 0 ? result.rows[0] : null;
};
