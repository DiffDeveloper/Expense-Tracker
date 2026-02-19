import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const TOKEN_HEADER = {
  alg: 'HS256',
  typ: 'JWT'
}

export const SESSION_COOKIE_NAME = 'expense_tracker_session'
export const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7
export const SHORT_SESSION_TTL_SECONDS = 60 * 60 * 24

export interface SessionPayload {
  userId: string
  email: string
  exp: number
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8')
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, storedPasswordHash: string): boolean {
  const [salt, expectedHash] = storedPasswordHash.split(':')

  if (!salt || !expectedHash) {
    return false
  }

  const computedHash = scryptSync(password, salt, 64).toString('hex')
  const expectedBuffer = Buffer.from(expectedHash, 'hex')
  const computedBuffer = Buffer.from(computedHash, 'hex')

  if (expectedBuffer.length !== computedBuffer.length) {
    return false
  }

  return timingSafeEqual(expectedBuffer, computedBuffer)
}

function signToken(unsignedToken: string, secret: string) {
  return createHmac('sha256', secret).update(unsignedToken).digest('base64url')
}

export function createSessionToken(
  userId: string,
  email: string,
  secret: string,
  ttlSeconds = DEFAULT_SESSION_TTL_SECONDS
): string {
  const header = base64UrlEncode(JSON.stringify(TOKEN_HEADER))
  const payload: SessionPayload = {
    userId,
    email,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds
  }
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const unsignedToken = `${header}.${encodedPayload}`
  const signature = signToken(unsignedToken, secret)

  return `${unsignedToken}.${signature}`
}

export function verifySessionToken(token: string, secret: string): SessionPayload | null {
  const [header, payload, signature] = token.split('.')

  if (!header || !payload || !signature) {
    return null
  }

  const unsignedToken = `${header}.${payload}`
  const expectedSignature = signToken(unsignedToken, secret)

  const expectedBuffer = Buffer.from(expectedSignature, 'utf8')
  const actualBuffer = Buffer.from(signature, 'utf8')

  if (expectedBuffer.length !== actualBuffer.length) {
    return null
  }

  if (!timingSafeEqual(expectedBuffer, actualBuffer)) {
    return null
  }

  try {
    const parsedPayload = JSON.parse(base64UrlDecode(payload)) as SessionPayload

    if (!parsedPayload.userId || !parsedPayload.email || !parsedPayload.exp) {
      return null
    }

    if (parsedPayload.exp * 1000 <= Date.now()) {
      return null
    }

    return parsedPayload
  }
  catch {
    return null
  }
}

export function getSessionCookieOptions(maxAge = DEFAULT_SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    path: '/',
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge
  }
}
