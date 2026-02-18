import { createError, getRouterParam, readBody } from 'h3'
import { requireSessionUser } from '../../utils/session'
import { parseExpenseInput } from '../../utils/validation'
import { updateExpense } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const user = requireSessionUser(event)
  const expenseId = getRouterParam(event, 'id')

  if (!expenseId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Expense id is missing.'
    })
  }

  const body = await readBody(event)
  const input = parseExpenseInput(body)
  const expense = updateExpense(user.id, expenseId, input)

  if (!expense) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Expense not found.'
    })
  }

  return {
    expense
  }
})
