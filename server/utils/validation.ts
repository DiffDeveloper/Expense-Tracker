import { createError } from 'h3'
import { EXPENSE_CATEGORIES, type ExpenseInput } from '~~/shared/types'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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
