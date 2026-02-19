import { createError } from 'h3'
import type { CurrencyCode, ExpenseRecord, MonthlyPlanRecord } from '~~/shared/types'

type AdviceSource = 'openai' | 'fallback'

interface ExpenseStats {
  monthlyTotal: number
  transactionCount: number
  topCategory: string
  topCategoryPercent: number
  groceryTotal: number
  averageTransaction: number
  incomeAmount: number
  savingsTarget: number
  plannedSpendable: number
  remainingBudget: number
}

export interface ExpenseAdviceResult {
  source: AdviceSource
  answer: string
  actions: string[]
  stats: ExpenseStats
}

const financeKeywords = [
  'expense',
  'spend',
  'budget',
  'save',
  'saving',
  'income',
  'salary',
  'grocery',
  'groceries',
  'rent',
  'utilities',
  'bill',
  'cashflow',
  'category',
  'monthly',
  'daily',
  'weekly',
  'finance',
  'money'
]

function roundMoney(value: number) {
  return Number(value.toFixed(2))
}

function getLocaleForCurrency(currencyCode: CurrencyCode): string {
  return currencyCode === 'THB' ? 'th-TH' : 'en-US'
}

function formatAmountForCurrency(amount: number, currencyCode: CurrencyCode): string {
  return new Intl.NumberFormat(getLocaleForCurrency(currencyCode), {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

function containsKeyword(question: string, keywords: string[]) {
  const lowered = question.toLowerCase()
  return keywords.some(keyword => lowered.includes(keyword))
}

function needsIncomeContext(question: string) {
  const lowered = question.toLowerCase()

  const incomeIntentKeywords = [
    'income',
    'salary',
    'save',
    'saving',
    'per day',
    'daily',
    'allowance',
    'how much can i spend'
  ]

  return incomeIntentKeywords.some(keyword => lowered.includes(keyword))
}

export function assertExpenseQuestionRelevant(question: string) {
  const normalized = question.trim().toLowerCase()

  if (normalized.length < 10 || normalized.length > 500) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Question must be between 10 and 500 characters.'
    })
  }

  if (!containsKeyword(normalized, financeKeywords)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Only expense tracking and budgeting questions are allowed.'
    })
  }
}

function buildStats(expenses: ExpenseRecord[], plan: MonthlyPlanRecord | null): ExpenseStats {
  const incomeAmount = plan?.incomeAmount || 0
  const savingsTarget = plan?.savingsTarget || 0
  const plannedSpendable = roundMoney(Math.max(0, incomeAmount - savingsTarget))

  if (!expenses.length) {
    return {
      monthlyTotal: 0,
      transactionCount: 0,
      topCategory: 'None',
      topCategoryPercent: 0,
      groceryTotal: 0,
      averageTransaction: 0,
      incomeAmount,
      savingsTarget,
      plannedSpendable,
      remainingBudget: plannedSpendable
    }
  }

  const byCategory = new Map<string, number>()
  let total = 0
  let groceryTotal = 0

  for (const expense of expenses) {
    total += expense.amount
    byCategory.set(expense.category, (byCategory.get(expense.category) || 0) + expense.amount)

    if (expense.category.toLowerCase() === 'food') {
      groceryTotal += expense.amount
    }
  }

  const [topCategory = 'None', topCategoryAmount = 0] =
    [...byCategory.entries()].sort((left, right) => right[1] - left[1])[0] || []

  return {
    monthlyTotal: roundMoney(total),
    transactionCount: expenses.length,
    topCategory,
    topCategoryPercent: total > 0 ? roundMoney((topCategoryAmount / total) * 100) : 0,
    groceryTotal: roundMoney(groceryTotal),
    averageTransaction: roundMoney(total / Math.max(1, expenses.length)),
    incomeAmount,
    savingsTarget,
    plannedSpendable,
    remainingBudget: roundMoney(plannedSpendable - total)
  }
}

function extractNumbers(question: string) {
  return [...question.matchAll(/\d+(?:\.\d+)?/g)].map(match => Number.parseFloat(match[0]))
}

function buildFallbackAdvice(
  question: string,
  expenses: ExpenseRecord[],
  plan: MonthlyPlanRecord | null,
  currencyCode: CurrencyCode
): ExpenseAdviceResult {
  const stats = buildStats(expenses, plan)
  const lowered = question.toLowerCase()
  const numbers = extractNumbers(question)

  if (needsIncomeContext(question) && stats.incomeAmount <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Add monthly income first to get daily allowance and savings planning advice.'
    })
  }

  if (!expenses.length) {
    return {
      source: 'fallback',
      answer: 'You do not have enough expense history for precise guidance yet. Log at least a week of transactions first, then ask this again.',
      actions: [
        'Track every purchase for 7 days without skipping categories.',
        'Separate needs and wants while entering each expense.',
        'Come back with your monthly income and savings target for a daily spending plan.'
      ],
      stats
    }
  }

  if (lowered.includes('grocery') || lowered.includes('food')) {
    const suggestedCap = roundMoney(stats.monthlyTotal * 0.25)

      return {
        source: 'fallback',
        answer: `Based on your current spending pattern, a practical grocery cap is around ${formatAmountForCurrency(suggestedCap, currencyCode)} for the month, then adjust down if food is already your top category.`,
        actions: [
        'Set one weekly grocery budget envelope and stop when it is reached.',
        'Create a fixed shopping list before each grocery run.',
        'Move high-frequency snacks and impulse items into a separate mini-budget.'
      ],
      stats
    }
  }

  if ((lowered.includes('daily') || lowered.includes('per day')) && lowered.includes('save')) {
    const income = stats.incomeAmount || numbers[0]
    const savingTarget = stats.savingsTarget || numbers[1]

    if (income && savingTarget >= 0 && income > savingTarget) {
      const spendableMonthly = roundMoney(income - savingTarget)
      const spendableDaily = roundMoney(spendableMonthly / 30)

      return {
        source: 'fallback',
        answer: `If your monthly income is ${formatAmountForCurrency(income, currencyCode)} and you want to save ${formatAmountForCurrency(savingTarget, currencyCode)}, keep monthly spending near ${formatAmountForCurrency(spendableMonthly, currencyCode)} (about ${formatAmountForCurrency(spendableDaily, currencyCode)} per day).`,
        actions: [
          'Track your daily total and alert yourself once you cross 80% of the daily cap.',
          `Reserve savings first, then spend from the remaining ${formatAmountForCurrency(spendableMonthly, currencyCode)}.`,
          `Your remaining monthly budget is currently ${formatAmountForCurrency(stats.remainingBudget, currencyCode)}.`,
          'Reduce your top category first if you exceed the daily limit for 3 days in a row.'
        ],
        stats
      }
    }
  }

  return {
    source: 'fallback',
    answer: `Your tracked monthly spend is ${formatAmountForCurrency(stats.monthlyTotal, currencyCode)} across ${stats.transactionCount} transactions. Focus first on controlling ${stats.topCategory}, which currently leads your spending profile.`,
    actions: [
      'Set a hard cap for your top category this month.',
      'Use a daily spend checkpoint based on your monthly target.',
      'Review category totals every weekend and trim one recurring non-essential cost.'
    ],
    stats
  }
}

function formatExpensesForPrompt(expenses: ExpenseRecord[]) {
  return expenses
    .slice(0, 80)
    .map(expense => ({
      title: expense.title,
      amount: expense.amount,
      category: expense.category,
      date: expense.date
    }))
}

function parseAiAnswer(rawText: string) {
  const text = rawText.trim()

  try {
    const parsed = JSON.parse(text) as { answer?: string, actions?: string[] }
    if (parsed.answer && Array.isArray(parsed.actions) && parsed.actions.length > 0) {
      return {
        answer: parsed.answer.trim(),
        actions: parsed.actions.map(item => item.trim()).filter(Boolean).slice(0, 4)
      }
    }
  }
  catch {
    // ignore and use fallback parser below
  }

  const lines = text
    .split('\n')
    .map(line => line.replace(/^[-*\d.\s]+/, '').trim())
    .filter(Boolean)

  return {
    answer: lines[0] || text,
    actions: lines.slice(1, 5)
  }
}

export async function generateExpenseAdvice(
  question: string,
  expenses: ExpenseRecord[],
  plan: MonthlyPlanRecord | null,
  apiKey: string,
  model: string,
  currencyCode: CurrencyCode = 'USD'
): Promise<ExpenseAdviceResult> {
  assertExpenseQuestionRelevant(question)

  const fallback = buildFallbackAdvice(question, expenses, plan, currencyCode)

  if (!apiKey) {
    return fallback
  }

  const stats = buildStats(expenses, plan)

  if (needsIncomeContext(question) && stats.incomeAmount <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Add monthly income first to get daily allowance and savings planning advice.'
    })
  }

  const prompt = [
    'You are an expense-tracking coach for a personal finance app.',
    'Answer only about budgeting, spending control, category planning, and savings strategy.',
    'If the question is outside expense tracking, respond with: REJECT: Only expense-tracking questions are allowed.',
    'Return JSON only: {"answer":"...","actions":["...","...","..."]}.',
    '',
    `User question: ${question}`,
    `Stats: ${JSON.stringify(stats)}`,
    `Monthly plan: ${JSON.stringify(plan || null)}`,
    `Currency code: ${currencyCode}`,
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
          temperature: 0.2,
          messages: [
            {
              role: 'system',
              content: 'You provide concise, practical expense and budgeting advice.'
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

    if (!content || content.startsWith('REJECT:')) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Only expense tracking and budgeting questions are allowed.'
      })
    }

    const parsed = parseAiAnswer(content)

    if (!parsed.answer) {
      return fallback
    }

    return {
      source: 'openai',
      answer: parsed.answer,
      actions: parsed.actions.length ? parsed.actions : fallback.actions,
      stats
    }
  }
  catch (error) {
    if ((error as { statusCode?: number })?.statusCode === 400) {
      throw error
    }

    return fallback
  }
}
