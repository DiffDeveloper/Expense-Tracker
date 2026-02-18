import { listUserExpenses } from '../../utils/db'
import { requireSessionUser } from '../../utils/session'

export default defineEventHandler((event) => {
  const user = requireSessionUser(event)

  return {
    expenses: listUserExpenses(user.id)
  }
})
