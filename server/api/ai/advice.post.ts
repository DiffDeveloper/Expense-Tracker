import { readBody } from 'h3'
import { generateExpenseAdvice } from '../../utils/ai'
import { findMonthlyPlan, listUserExpenses } from '../../utils/db'
import { enforceRateLimit } from '../../utils/rate-limit'
import { requireSessionUser } from '../../utils/session'
import { parseMonthValue } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  enforceRateLimit(event, 'ai-advice', {
    max: 25,
    windowMs: 10 * 60 * 1000,
    message: 'Too many AI advice requests. Please try again in a few minutes.'
  })

  const user = await requireSessionUser(event)
  const body = await readBody(event)
  const question = typeof body?.question === 'string' ? body.question.trim() : ''
  const month = parseMonthValue(body?.month)

  const config = useRuntimeConfig(event)
  const [monthlyExpenses, monthlyPlan] = await Promise.all([
    listUserExpenses(user.id, month),
    findMonthlyPlan(user.id, month)
  ])

  const result = await generateExpenseAdvice(
    question,
    monthlyExpenses,
    monthlyPlan,
    config.openaiApiKey,
    config.openaiModel,
    user.currencyCode
  )

  return {
    source: result.source,
    answer: result.answer,
    actions: result.actions,
    stats: result.stats
  }
})
