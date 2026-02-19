import { listUserMonthlySummaries } from '../../utils/db'
import { requireSessionUser } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)

  return {
    months: await listUserMonthlySummaries(user.id)
  }
})
