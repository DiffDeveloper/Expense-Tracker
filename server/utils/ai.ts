import type { ExpenseRecord } from '~~/shared/types'

type SuggestionSource = 'openai' | 'fallback'

interface ExpenseStats {
  monthlyTotal: number
  transactionCount: number
  topCategory: string
  topCategoryPercent: number
}

interface SuggestionResult {
  source: SuggestionSource
  suggestions: string[]
  stats: ExpenseStats
}

function roundMoney(value: number) {
  return Number(value.toFixed(2))
}

function buildStats(expenses: ExpenseRecord[]): ExpenseStats {
  if (!expenses.length) {
    return {
      monthlyTotal: 0,
      transactionCount: 0,
      topCategory: 'None',
      topCategoryPercent: 0
    }
  }

  const byCategory = new Map<string, number>()
  let total = 0

  for (const expense of expenses) {
    total += expense.amount
    byCategory.set(expense.category, (byCategory.get(expense.category) || 0) + expense.amount)
  }

  const [topCategory = 'None', topCategoryAmount = 0] =
    [...byCategory.entries()].sort((left, right) => right[1] - left[1])[0] || []

  return {
    monthlyTotal: roundMoney(total),
    transactionCount: expenses.length,
    topCategory,
    topCategoryPercent: total > 0 ? roundMoney((topCategoryAmount / total) * 100) : 0
  }
}

function fallbackSuggestions(expenses: ExpenseRecord[]) {
  const stats = buildStats(expenses)
  const suggestions: string[] = []

  if (!expenses.length) {
    suggestions.push('Start by logging at least 5 expenses this week so the AI can spot patterns.')
    suggestions.push('Create a simple monthly target for your total spending and track your progress daily.')
    suggestions.push('Use categories consistently so your future insights are more accurate.')
    return {
      source: 'fallback' as const,
      suggestions,
      stats
    }
  }

  if (stats.topCategory !== 'None' && stats.topCategoryPercent >= 35) {
    suggestions.push(
      `${stats.topCategory} is ${stats.topCategoryPercent}% of your tracked spend. Try setting a weekly cap for this category.`
    )
  }

  const averageExpense = stats.monthlyTotal / Math.max(1, stats.transactionCount)
  if (averageExpense > 80) {
    suggestions.push(
      `Your average expense is $${roundMoney(averageExpense)}. Flag purchases above this amount before you confirm them.`
    )
  }

  suggestions.push('Schedule one no-spend day each week to reduce impulse purchases.')
  suggestions.push('Transfer a small amount to savings whenever your weekly spend is below plan.')

  return {
    source: 'fallback' as const,
    suggestions: suggestions.slice(0, 4),
    stats
  }
}

function formatExpensesForPrompt(expenses: ExpenseRecord[]) {
  return expenses
    .slice(0, 50)
    .map((expense) => ({
      title: expense.title,
      amount: expense.amount,
      category: expense.category,
      date: expense.date
    }))
}

function parseAiSuggestions(rawText: string) {
  return rawText
    .split('\n')
    .map((line) => line.replace(/^[-*\d.\s]+/, '').trim())
    .filter((line) => line.length > 0)
    .slice(0, 4)
}

export async function generateExpenseSuggestions(
  expenses: ExpenseRecord[],
  apiKey: string,
  model: string
): Promise<SuggestionResult> {
  const fallback = fallbackSuggestions(expenses)

  if (!apiKey) {
    return fallback
  }

  const stats = buildStats(expenses)

  const prompt = [
    'You are a budgeting coach.',
    'Create exactly 3 concise and practical suggestions (1 sentence each).',
    'Focus on reducing waste while still being realistic.',
    'Do not mention that you are an AI.',
    '',
    `Stats: ${JSON.stringify(stats)}`,
    `Recent expenses: ${JSON.stringify(formatExpensesForPrompt(expenses))}`
  ].join('\n')

  try {
    const response = await $fetch<{ choices?: Array<{ message?: { content?: string } }> }>(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`
        },
        body: {
          model,
          temperature: 0.3,
          messages: [
            {
              role: 'system',
              content: 'You provide short, clear financial suggestions based on spending data.'
            },
            {
              role: 'user',
              content: prompt
            }
          ]
        },
        timeout: 15000
      }
    )

    const content = response.choices?.[0]?.message?.content?.trim() || ''
    const suggestions = parseAiSuggestions(content)

    if (!suggestions.length) {
      return fallback
    }

    return {
      source: 'openai',
      suggestions,
      stats
    }
  }
  catch {
    return fallback
  }
}
