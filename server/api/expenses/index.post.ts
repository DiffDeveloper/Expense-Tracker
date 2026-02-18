import { readBody } from 'h3'
import { createExpense } from '../../utils/db'
import { requireSessionUser } from '../../utils/session'
import { parseExpenseInput } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  const user = requireSessionUser(event)
  const body = await readBody(event)
  const input = parseExpenseInput(body)

  return {
    expense: createExpense(user.id, input)
  }
})
