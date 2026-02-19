import { getQuery } from 'h3'
import { listUserExpenses } from '../../utils/db'
import { requireSessionUser } from '../../utils/session'
import { parseOptionalMonthValue } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const query = getQuery(event)
  const month = parseOptionalMonthValue(query.month)

  return {
    expenses: await listUserExpenses(user.id, month)
  }
})
