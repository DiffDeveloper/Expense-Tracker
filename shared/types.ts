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

export interface UserRecord {
  id: string
  email: string
  passwordHash: string
  createdAt: string
}

export interface UserPublic {
  id: string
  email: string
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

export interface DatabaseSchema {
  version: number
  users: UserRecord[]
  expenses: ExpenseRecord[]
}
