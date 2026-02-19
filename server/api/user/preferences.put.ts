import { createError, readBody } from 'h3'
import { toPublicUser, updateUserCurrency } from '../../utils/db'
import { requireSessionUser } from '../../utils/session'
import { parseCurrencyCode } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const body = await readBody(event)
  const currencyCode = parseCurrencyCode(body?.currencyCode)

  const updatedUser = await updateUserCurrency(user.id, currencyCode)

  if (!updatedUser) {
    throw createError({
      statusCode: 404,
      statusMessage: 'User not found.'
    })
  }

  return {
    user: toPublicUser(updatedUser)
  }
})
