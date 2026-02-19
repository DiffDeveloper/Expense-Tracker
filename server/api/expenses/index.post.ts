import { readBody } from 'h3'
import { createExpense } from '../../utils/db'
import { requireSessionUser } from '../../utils/session'
import { parseExpenseInput } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const body = await readBody(event)
  const input = parseExpenseInput(body)

  return {
    expense: await createExpense(user.id, input)
  }
})
