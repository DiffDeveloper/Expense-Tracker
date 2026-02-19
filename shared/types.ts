export const EXPENSE_CATEGORIES = [
  'Housing',
  'Food',
  'Transportation',
  'Utilities',
  'Healthcare',
  'Entertainment',
  'Education',
  'Savings',
  'Shopping',
  'Other'
] as const

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export const SUPPORTED_CURRENCIES = ['USD', 'THB'] as const

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]

export interface UserRecord {
  id: string
  email: string
  username: string
  currencyCode: CurrencyCode
  passwordHash: string
  createdAt: string
}

export interface UserPublic {
  id: string
  email: string
  username: string
  currencyCode: CurrencyCode
  createdAt: string
}

export interface ExpenseRecord {
  id: string
  userId: string
  title: string
  amount: number
  category: ExpenseCategory
  date: string
  notes: string
  createdAt: string
}

export interface ExpenseInput {
  title: string
  amount: number
  category: ExpenseCategory
  date: string
  notes?: string
}

export interface MonthlySummary {
  month: string
  totalAmount: number
  transactionCount: number
  topCategory: string
  isClosed: boolean
  closedAt: string | null
}

export interface MonthlySnapshotRecord extends MonthlySummary {
  id: string
  userId: string
  categoryBreakdown: Record<string, number>
  summaryText: string
}

export interface MonthlyPlanRecord {
  id: string
  userId: string
  month: string
  incomeAmount: number
  savingsTarget: number
  notes: string
  createdAt: string
  updatedAt: string
}

export interface MonthlyPlanInput {
  month: string
  incomeAmount: number
  savingsTarget: number
  notes?: string
}

export interface MonthlyTrendPoint {
  month: string
  expenseTotal: number
  incomeAmount: number
  savingsTarget: number
  plannedSpendable: number
  remainingBudget: number
  isClosed: boolean
}
