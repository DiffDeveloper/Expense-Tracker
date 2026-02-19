import { createError } from 'h3'
import {
  EXPENSE_CATEGORIES,
  SUPPORTED_CURRENCIES,
  type CurrencyCode,
  type ExpenseInput,
  type MonthlyPlanInput
} from '~~/shared/types'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/
const usernamePattern = /^[a-zA-Z0-9_]+$/

export function normalizeEmail(value: unknown): string {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim().toLowerCase()
}

export function assertValidCredentials(email: unknown, password: unknown) {
  const normalizedEmail = normalizeEmail(email)

  if (!emailPattern.test(normalizedEmail)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Please provide a valid email address.'
    })
  }

  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Password must be between 8 and 128 characters.'
    })
  }

  return {
    email: normalizedEmail,
    password
  }
}

export function assertValidRegistrationCredentials(
  email: unknown,
  username: unknown,
  password: unknown,
  confirmPassword: unknown
) {
  const credentials = assertValidCredentials(email, password)
  const normalizedUsername = typeof username === 'string' ? username.trim() : ''

  if (
    normalizedUsername.length < 3
    || normalizedUsername.length > 24
    || !usernamePattern.test(normalizedUsername)
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Username must be 3-24 characters and use only letters, numbers, and underscore.'
    })
  }

  if (typeof confirmPassword !== 'string' || confirmPassword !== credentials.password) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Password and confirm password must match.'
    })
  }

  return {
    ...credentials,
    username: normalizedUsername
  }
}

export function parseRememberMe(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'string') {
    return value.trim().toLowerCase() === 'true'
  }

  return false
}

export function parseCurrencyCode(value: unknown, fieldName = 'currencyCode'): CurrencyCode {
  const currencyCode = typeof value === 'string' ? value.trim().toUpperCase() : ''

  if (!SUPPORTED_CURRENCIES.includes(currencyCode as CurrencyCode)) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} must be either USD or THB.`
    })
  }

  return currencyCode as CurrencyCode
}

export function parseMonthValue(value: unknown, fieldName = 'month'): string {
  const month = typeof value === 'string' ? value.trim() : ''

  if (!monthPattern.test(month)) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} must be in YYYY-MM format.`
    })
  }

  return month
}

export function parseOptionalMonthValue(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined
  }

  return parseMonthValue(value)
}

export function getMonthFromDateString(dateValue: string): string {
  return dateValue.slice(0, 7)
}

export function parseMonthlyPlanInput(payload: unknown): MonthlyPlanInput {
  const body = (payload || {}) as Record<string, unknown>
  const month = parseMonthValue(body.month)

  const normalizeNumericInput = (value: unknown, fallback?: number) => {
    if (value === undefined || value === null || value === '') {
      return fallback
    }

    if (typeof value === 'number') {
      return value
    }

    if (typeof value === 'string') {
      return Number.parseFloat(value)
    }

    return Number.NaN
  }

  const rawIncome = normalizeNumericInput(body.incomeAmount)

  if (typeof rawIncome !== 'number' || Number.isNaN(rawIncome) || rawIncome <= 0 || rawIncome > 1_000_000_000) {
    throw createError({
      statusCode: 400,
      statusMessage: 'incomeAmount must be greater than 0.'
    })
  }

  const rawSavings = normalizeNumericInput(body.savingsTarget, 0)

  if (typeof rawSavings !== 'number' || Number.isNaN(rawSavings) || rawSavings < 0 || rawSavings > 1_000_000_000) {
    throw createError({
      statusCode: 400,
      statusMessage: 'savingsTarget must be a number between 0 and 1,000,000,000.'
    })
  }

  const incomeAmount = Number(rawIncome.toFixed(2))
  const savingsTarget = Number(rawSavings.toFixed(2))

  if (savingsTarget > incomeAmount) {
    throw createError({
      statusCode: 400,
      statusMessage: 'savingsTarget cannot be greater than incomeAmount.'
    })
  }

  const notes = typeof body.notes === 'string' ? body.notes.trim() : ''
  if (notes.length > 300) {
    throw createError({
      statusCode: 400,
      statusMessage: 'notes cannot exceed 300 characters.'
    })
  }

  return {
    month,
    incomeAmount,
    savingsTarget,
    notes
  }
}

export function parseExpenseInput(payload: unknown): ExpenseInput {
  const body = (payload || {}) as Record<string, unknown>

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (title.length < 2 || title.length > 80) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Title must be between 2 and 80 characters.'
    })
  }

  const rawAmount = typeof body.amount === 'string'
    ? Number.parseFloat(body.amount)
    : body.amount

  if (typeof rawAmount !== 'number' || Number.isNaN(rawAmount) || rawAmount <= 0 || rawAmount > 1_000_000) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Amount must be a number greater than 0.'
    })
  }

  const category = typeof body.category === 'string' ? body.category : ''
  if (!EXPENSE_CATEGORIES.includes(category as (typeof EXPENSE_CATEGORIES)[number])) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Please select a valid category.'
    })
  }

  const date = typeof body.date === 'string' ? body.date.trim() : ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Date must be in YYYY-MM-DD format.'
    })
  }

  const notes = typeof body.notes === 'string' ? body.notes.trim() : ''
  if (notes.length > 280) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Notes cannot exceed 280 characters.'
    })
  }

  return {
    title,
    amount: Number(rawAmount.toFixed(2)),
    category: category as (typeof EXPENSE_CATEGORIES)[number],
    date,
    notes
  }
}
