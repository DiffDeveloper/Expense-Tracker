import { createError, readBody } from 'h3'
import { verifyPassword } from '../../utils/auth'
import { findUserByEmail, toPublicUser } from '../../utils/db'
import { enforceRateLimit } from '../../utils/rate-limit'
import { setUserSession } from '../../utils/session'
import { assertValidCredentials, parseRememberMe } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  enforceRateLimit(event, 'auth-login', {
    max: 15,
    windowMs: 10 * 60 * 1000,
    message: 'Too many login attempts. Please try again soon.'
  })

  const body = await readBody(event)
  const { email, password } = assertValidCredentials(body?.email, body?.password)
  const rememberMe = parseRememberMe(body?.rememberMe)
  const user = await findUserByEmail(email)

  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid email or password.'
    })
  }

  setUserSession(event, user.id, user.email, { rememberMe })

  return {
    user: toPublicUser(user)
  }
})
