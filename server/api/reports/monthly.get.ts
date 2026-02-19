import { createError, getQuery } from 'h3'
import { getUserMonthlyDetail } from '../../utils/db'
import { requireSessionUser } from '../../utils/session'
import { parseMonthValue } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const query = getQuery(event)

  if (!query.month) {
    throw createError({
      statusCode: 400,
      statusMessage: 'month is required in YYYY-MM format.'
    })
  }

  const month = parseMonthValue(query.month)
  const detail = await getUserMonthlyDetail(user.id, month)

  return {
    month: detail
  }
})
