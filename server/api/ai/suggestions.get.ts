import { generateExpenseSuggestions } from '../../utils/ai'
import { listUserExpenses } from '../../utils/db'
import { requireSessionUser } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const user = requireSessionUser(event)
  const config = useRuntimeConfig(event)
  const expenses = listUserExpenses(user.id)

  const result = await generateExpenseSuggestions(
    expenses,
    config.openaiApiKey,
    config.openaiModel
  )

  return {
    source: result.source,
    suggestions: result.suggestions,
    stats: result.stats
  }
})
