import { createError, getHeader, readBody } from 'h3'
import { hashPassword } from '../../utils/auth'
import { createUser, findUserByEmail, findUserByUsername, toPublicUser } from '../../utils/db'
import { enforceRateLimit } from '../../utils/rate-limit'
import { setUserSession } from '../../utils/session'
import { assertValidRegistrationCredentials } from '../../utils/validation'
import type { CurrencyCode } from '~~/shared/types'

function detectCurrencyFromLanguage(headerValue: string | undefined): CurrencyCode {
  if (!headerValue) {
    return 'USD'
  }

  const locales = headerValue
    .toLowerCase()
    .split(',')
    .map(entry => entry.split(';')[0]?.trim())
    .filter(Boolean)

  return locales.some(locale => locale.startsWith('th')) ? 'THB' : 'USD'
}

export default defineEventHandler(async (event) => {
  enforceRateLimit(event, 'auth-register', {
    max: 8,
    windowMs: 10 * 60 * 1000,
    message: 'Too many registration attempts. Please try again soon.'
  })

  const body = await readBody(event)
  const { email, username, password } = assertValidRegistrationCredentials(
    body?.email,
    body?.username,
    body?.password,
    body?.confirmPassword
  )

  const existingUser = await findUserByEmail(email)

  if (existingUser) {
    throw createError({
      statusCode: 409,
      statusMessage: 'An account with this email already exists.'
    })
  }

  const existingUsername = await findUserByUsername(username)

  if (existingUsername) {
    throw createError({
      statusCode: 409,
      statusMessage: 'This username is already taken.'
    })
  }

  const currencyCode = detectCurrencyFromLanguage(getHeader(event, 'accept-language'))
  const user = await createUser(email, username, hashPassword(password), currencyCode)
  setUserSession(event, user.id, user.email)

  return {
    user: toPublicUser(user)
  }
})
