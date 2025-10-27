import jwt from 'jsonwebtoken';
import { JwtPayload } from '../types/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

const secret = JWT_SECRET as unknown as jwt.Secret;

// Generate access token
export const generateAccessToken = (payload: JwtPayload): string => {
  return (jwt as any).sign(payload, secret, {
    expiresIn: JWT_EXPIRES_IN,
  }) as string;
};

// Generate refresh token
export const generateRefreshToken = (payload: JwtPayload): string => {
  return (jwt as any).sign(payload, secret, {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
  }) as string;
};

// Verify token
export const verifyToken = (token: string): JwtPayload => {
  try {
  const decoded = (jwt as any).verify(token, secret) as JwtPayload;
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

// Decode token without verification (for debugging)
export const decodeToken = (token: string): JwtPayload | null => {
  try {
  return (jwt as any).decode(token) as JwtPayload;
  } catch (error) {
    return null;
  }
};