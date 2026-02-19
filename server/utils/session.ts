import { createError, deleteCookie, getCookie, setCookie, type H3Event } from 'h3'
import { findUserById, toPublicUser } from './db'
import {
  DEFAULT_SESSION_TTL_SECONDS,
  SHORT_SESSION_TTL_SECONDS,
  createSessionToken,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
  verifySessionToken
} from './auth'

function getJwtSecret(event: H3Event) {
  const config = useRuntimeConfig(event)

  if (!config.jwtSecret) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Server JWT configuration is missing.'
    })
  }

  return config.jwtSecret
}

interface SetUserSessionOptions {
  rememberMe?: boolean
}

export function setUserSession(event: H3Event, userId: string, email: string, options: SetUserSessionOptions = {}) {
  const ttl = options.rememberMe === false ? SHORT_SESSION_TTL_SECONDS : DEFAULT_SESSION_TTL_SECONDS
  const token = createSessionToken(userId, email, getJwtSecret(event), ttl)

  setCookie(event, SESSION_COOKIE_NAME, token, getSessionCookieOptions(ttl))
}

export function clearUserSession(event: H3Event) {
  deleteCookie(event, SESSION_COOKIE_NAME, {
    path: '/'
  })
}

export async function getOptionalSessionUser(event: H3Event) {
  const token = getCookie(event, SESSION_COOKIE_NAME)

  if (!token) {
    return null
  }

  const payload = verifySessionToken(token, getJwtSecret(event))

  if (!payload) {
    return null
  }

  const user = await findUserById(payload.userId)

  if (!user) {
    return null
  }

  return toPublicUser(user)
}

export async function requireSessionUser(event: H3Event) {
  const user = await getOptionalSessionUser(event)

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'You need to sign in first.'
    })
  }

  return user
}
