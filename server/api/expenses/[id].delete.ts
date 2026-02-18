import { createError, getRouterParam } from 'h3'
import { deleteExpense } from '../../utils/db'
import { requireSessionUser } from '../../utils/session'

export default defineEventHandler((event) => {
  const user = requireSessionUser(event)
  const expenseId = getRouterParam(event, 'id')

  if (!expenseId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Expense id is missing.'
    })
  }

  const deleted = deleteExpense(user.id, expenseId)

  if (!deleted) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Expense not found.'
    })
  }

  return {
    ok: true
  }
})
