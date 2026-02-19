import { readBody } from 'h3'
import { closeUserMonth } from '../../../utils/db'
import { requireSessionUser } from '../../../utils/session'
import { parseMonthValue } from '../../../utils/validation'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const body = await readBody(event)
  const month = parseMonthValue(body?.month)

  return {
    snapshot: await closeUserMonth(user.id, month, user.currencyCode)
  }
})
