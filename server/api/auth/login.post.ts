import { createError, readBody } from 'h3'
import { verifyPassword } from '../../utils/auth'
import { findUserByEmail, toPublicUser } from '../../utils/db'
import { setUserSession } from '../../utils/session'
import { assertValidCredentials } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email, password } = assertValidCredentials(body?.email, body?.password)
  const user = findUserByEmail(email)

  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid email or password.'
    })
  }

  setUserSession(event, user.id, user.email)

  return {
    user: toPublicUser(user)
  }
})
