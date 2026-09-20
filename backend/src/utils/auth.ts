import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const SALT_ROUNDS = 10
const JWT_SECRET = process.env.JWT_SECRET?.trim() || (
  process.env.NODE_ENV === 'production'
    ? (() => { throw new Error('JWT_SECRET must be configured in production') })()
    : 'medical-dist-secret-change-in-production'
)
const JWT_EXPIRY = '24h'

export interface TokenPayload {
  userId: string
  email: string
  role: string
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY })
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload
  } catch {
    return null
  }
}

export function extractToken(authHeader?: string): string | null {
  if (!authHeader) return null
  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null
  return parts[1]
}
