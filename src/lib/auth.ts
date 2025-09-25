import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getAnalyticsDb } from './db';
import { User, JWTPayload } from '../types/auth';

interface UserWithPassword extends User {
  password_hash: string;
  salt: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key';
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
  const hash = await bcrypt.hash(password, salt);
  return { hash, salt };
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate JWT tokens for a user
 */
export function generateTokens(user: User): { access_token: string; refresh_token: string; expires_in: number } {
  const payload: JWTPayload = {
    user_id: user.id,
    username: user.username,
    role: user.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (15 * 60), // 15 minutes
  };

  const refreshPayload = {
    user_id: user.id,
    username: user.username,
    role: user.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
  };

  const access_token = jwt.sign(payload, JWT_SECRET);
  const refresh_token = jwt.sign(refreshPayload, JWT_REFRESH_SECRET);

  return {
    access_token,
    refresh_token,
    expires_in: 15 * 60, // 15 minutes in seconds
  };
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JWTPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    throw new AuthError('Invalid or expired token');
  }
}

/**
 * Verify and decode a refresh token
 */
export function verifyRefreshToken(token: string): JWTPayload {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as JWTPayload;
  } catch {
    throw new AuthError('Invalid or expired refresh token');
  }
}

/**
 * Get user by username or email
 */
export async function getUserByCredentials(identifier: string): Promise<UserWithPassword | null> {
  console.log('🔍 Looking up user by identifier:', identifier);
  const db = await getAnalyticsDb();
  
  const [rows] = await db.execute(
    'SELECT id, username, email, password_hash, salt, role, is_active, created_at, updated_at FROM users WHERE (username = ? OR email = ?) AND is_active = TRUE',
    [identifier, identifier]
  );

  const users = rows as UserWithPassword[];
  const user = users.length > 0 ? users[0] : null;
  
  if (user) {
    console.log('User found:', user.username);
  } else {
    console.log('User not found for identifier:', identifier);
  }
  
  return user;
}

/**
 * Create a new user session
 */
export async function createUserSession(
  userId: number,
  sessionToken: string,
  refreshToken: string,
  expiresAt: Date,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const db = await getAnalyticsDb();
  
  await db.execute(
    'INSERT INTO user_sessions (user_id, session_token, refresh_token, expires_at, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, sessionToken, refreshToken, expiresAt, ipAddress, userAgent]
  );
}

/**
 * Get user session by token
 */
export async function getUserSession(sessionToken: string): Promise<Record<string, unknown> | null> {
  const db = await getAnalyticsDb();
  
  const [rows] = await db.execute(
    'SELECT * FROM user_sessions WHERE session_token = ? AND expires_at > NOW()',
    [sessionToken]
  );

  const sessions = rows as Record<string, unknown>[];
  return sessions.length > 0 ? sessions[0] : null;
}

/**
 * Delete user session
 */
export async function deleteUserSession(sessionToken: string): Promise<void> {
  const db = await getAnalyticsDb();
  
  await db.execute(
    'DELETE FROM user_sessions WHERE session_token = ?',
    [sessionToken]
  );
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(): Promise<void> {
  const db = await getAnalyticsDb();
  
  await db.execute(
    'DELETE FROM user_sessions WHERE expires_at < NOW()'
  );
}

/**
 * Get user by ID
 */
export async function getUserById(userId: number): Promise<User | null> {
  const db = await getAnalyticsDb();
  
  const [rows] = await db.execute(
    'SELECT id, username, email, role, is_active, created_at, updated_at FROM users WHERE id = ? AND is_active = TRUE',
    [userId]
  );

  const users = rows as User[];
  return users.length > 0 ? users[0] : null;
}

/**
 * Create a new user
 */
export async function createUser(
  username: string,
  email: string,
  password: string,
  role: 'admin' | 'user' | 'viewer' = 'user'
): Promise<User> {
  const db = await getAnalyticsDb();
  
  const { hash, salt } = await hashPassword(password);
  
  const [result] = await db.execute(
    'INSERT INTO users (username, email, password_hash, salt, role) VALUES (?, ?, ?, ?, ?)',
    [username, email, hash, salt, role]
  );

  const insertResult = result as { insertId: number };
  const userId = insertResult.insertId;

  return getUserById(userId) as Promise<User>;
} 