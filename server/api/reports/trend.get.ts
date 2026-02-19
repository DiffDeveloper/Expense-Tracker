import { getQuery } from 'h3'
import { listUserMonthlyTrend } from '../../utils/db'
import { requireSessionUser } from '../../utils/session'

function parseMonthsLimit(value: unknown): number {
  if (value === undefined || value === null || value === '') {
    return 8
  }

  const parsed = typeof value === 'string'
    ? Number.parseInt(value, 10)
    : Number.NaN

  if (Number.isNaN(parsed)) {
    return 8
  }

  return Math.min(24, Math.max(3, parsed))
}

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const query = getQuery(event)
  const months = parseMonthsLimit(query.months)

  return {
    points: await listUserMonthlyTrend(user.id, months)
  }
})
