import { createError, deleteCookie, getCookie, setCookie, type H3Event } from 'h3'
import { findUserById, toPublicUser } from './db'
import {
  createSessionToken,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
  verifySessionToken
} from './auth'

export function setUserSession(event: H3Event, userId: string, email: string) {
  const config = useRuntimeConfig(event)
  const token = createSessionToken(userId, email, config.jwtSecret)

  setCookie(event, SESSION_COOKIE_NAME, token, getSessionCookieOptions())
}

export function clearUserSession(event: H3Event) {
  deleteCookie(event, SESSION_COOKIE_NAME, {
    path: '/'
  })
}

export function getOptionalSessionUser(event: H3Event) {
  const config = useRuntimeConfig(event)
  const token = getCookie(event, SESSION_COOKIE_NAME)

  if (!token) {
    return null
  }

  const payload = verifySessionToken(token, config.jwtSecret)

  if (!payload) {
    return null
  }

  const user = findUserById(payload.userId)

  if (!user) {
    return null
  }

  return toPublicUser(user)
}

export function requireSessionUser(event: H3Event) {
  const user = getOptionalSessionUser(event)

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'You need to sign in first.'
    })
  }

  return user
}
