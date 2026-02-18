import { createError, readBody } from 'h3'
import { hashPassword } from '../../utils/auth'
import { createUser, findUserByEmail, toPublicUser } from '../../utils/db'
import { setUserSession } from '../../utils/session'
import { assertValidCredentials } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email, password } = assertValidCredentials(body?.email, body?.password)

  const existingUser = findUserByEmail(email)

  if (existingUser) {
    throw createError({
      statusCode: 409,
      statusMessage: 'An account with this email already exists.'
    })
  }

  const user = createUser(email, hashPassword(password))
  setUserSession(event, user.id, user.email)

  return {
    user: toPublicUser(user)
  }
})
