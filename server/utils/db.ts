import { randomUUID } from 'node:crypto'
import { createError } from 'h3'
import { and, desc, eq, gte, lt } from 'drizzle-orm'
import type {
  CurrencyCode,
  ExpenseInput,
  ExpenseRecord,
  MonthlyPlanInput,
  MonthlyPlanRecord,
  MonthlySnapshotRecord,
  MonthlySummary,
  MonthlyTrendPoint,
  UserPublic,
  UserRecord
} from '~~/shared/types'
import { db } from '../db/client'
import { expenses, monthlyPlans, monthlySnapshots, users } from '../db/schema'
import { getMonthFromDateString } from './validation'

interface ComputedMonthStats {
  totalAmount: number
  transactionCount: number
  topCategory: string
  categoryBreakdown: Record<string, number>
}

export interface MonthlyBudgetInsights {
  plannedSpendable: number
  remainingBudget: number
  daysRemaining: number
  dailyAllowance: number
  incomeRequired: boolean
}

export interface MonthlyDetail {
  summary: MonthlySummary
  plan: MonthlyPlanRecord | null
  budget: MonthlyBudgetInsights
  categoryBreakdown: Record<string, number>
  summaryText: string
  expenses: ExpenseRecord[]
}

function toIsoString(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString()
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString()
}

function roundMoney(value: number): number {
  return Number(value.toFixed(2))
}

function isMissingCurrencyColumnError(error: unknown): boolean {
  const message = (error as { message?: string })?.message || String(error)
  const lowered = message.toLowerCase()

  return lowered.includes('currency_code') && lowered.includes('does not exist')
}

function throwCurrencyMigrationError(): never {
  throw createError({
    statusCode: 500,
    statusMessage: 'Database schema is outdated. Run npm run db:migrate and restart the server.'
  })
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

function toUserRecord(row: typeof users.$inferSelect): UserRecord {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    currencyCode: row.currencyCode as CurrencyCode,
    passwordHash: row.passwordHash,
    createdAt: toIsoString(row.createdAt)
  }
}

function toExpenseRecord(row: typeof expenses.$inferSelect): ExpenseRecord {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    amount: row.amount,
    category: row.category as ExpenseRecord['category'],
    date: row.date,
    notes: row.notes,
    createdAt: toIsoString(row.createdAt)
  }
}

function toMonthlySnapshotRecord(row: typeof monthlySnapshots.$inferSelect): MonthlySnapshotRecord {
  return {
    id: row.id,
    userId: row.userId,
    month: row.month,
    isClosed: row.isClosed,
    totalAmount: row.totalAmount,
    transactionCount: row.transactionCount,
    topCategory: row.topCategory,
    categoryBreakdown: row.categoryBreakdown,
    summaryText: row.summaryText,
    closedAt: toIsoString(row.closedAt)
  }
}

function toMonthlyPlanRecord(row: typeof monthlyPlans.$inferSelect): MonthlyPlanRecord {
  return {
    id: row.id,
    userId: row.userId,
    month: row.month,
    incomeAmount: roundMoney(row.incomeAmount),
    savingsTarget: roundMoney(row.savingsTarget),
    notes: row.notes,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt)
  }
}

function getDaysRemainingInMonth(month: string): number {
  const [yearString, monthString] = month.split('-')
  const year = Number.parseInt(yearString, 10)
  const monthNumber = Number.parseInt(monthString, 10)
  const today = new Date()
  const selectedPrefix = `${yearString}-${monthString}`
  const todayPrefix = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}`

  if (selectedPrefix < todayPrefix) {
    return 0
  }

  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()

  if (selectedPrefix > todayPrefix) {
    return lastDay
  }

  const todayDay = today.getUTCDate()
  return Math.max(1, lastDay - todayDay + 1)
}

function buildMonthlyBudgetInsights(
  month: string,
  totalAmount: number,
  plan: MonthlyPlanRecord | null
): MonthlyBudgetInsights {
  if (!plan || plan.incomeAmount <= 0) {
    return {
      plannedSpendable: 0,
      remainingBudget: 0,
      daysRemaining: getDaysRemainingInMonth(month),
      dailyAllowance: 0,
      incomeRequired: true
    }
  }

  const plannedSpendable = roundMoney(Math.max(0, plan.incomeAmount - plan.savingsTarget))
  const remainingBudget = roundMoney(plannedSpendable - totalAmount)
  const daysRemaining = getDaysRemainingInMonth(month)
  const dailyAllowance = daysRemaining > 0
    ? roundMoney(remainingBudget / daysRemaining)
    : roundMoney(remainingBudget)

  return {
    plannedSpendable,
    remainingBudget,
    daysRemaining,
    dailyAllowance,
    incomeRequired: false
  }
}

function getMonthBounds(month: string) {
  const [yearString, monthString] = month.split('-')
  const year = Number.parseInt(yearString, 10)
  const monthNumber = Number.parseInt(monthString, 10)

  const nextYear = monthNumber === 12 ? year + 1 : year
  const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1

  return {
    start: `${month}-01`,
    nextStart: `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
  }
}

function computeMonthStats(records: ExpenseRecord[]): ComputedMonthStats {
  if (!records.length) {
    return {
      totalAmount: 0,
      transactionCount: 0,
      topCategory: 'None',
      categoryBreakdown: {}
    }
  }

  const grouped = new Map<string, number>()
  let total = 0

  for (const record of records) {
    total += record.amount
    grouped.set(record.category, (grouped.get(record.category) || 0) + record.amount)
  }

  const sortedCategories = [...grouped.entries()].sort((left, right) => right[1] - left[1])
  const topCategory = sortedCategories[0]?.[0] || 'None'

  return {
    totalAmount: roundMoney(total),
    transactionCount: records.length,
    topCategory,
    categoryBreakdown: Object.fromEntries(
      sortedCategories.map(([category, amount]) => [category, roundMoney(amount)])
    )
  }
}

async function findClosedSnapshot(userId: string, month: string) {
  const [snapshot] = await db
    .select()
    .from(monthlySnapshots)
    .where(
      and(
        eq(monthlySnapshots.userId, userId),
        eq(monthlySnapshots.month, month),
        eq(monthlySnapshots.isClosed, true)
      )
    )
    .limit(1)

  return snapshot
}

export async function findMonthlyPlan(userId: string, month: string): Promise<MonthlyPlanRecord | null> {
  const [plan] = await db
    .select()
    .from(monthlyPlans)
    .where(
      and(
        eq(monthlyPlans.userId, userId),
        eq(monthlyPlans.month, month)
      )
    )
    .limit(1)

  return plan ? toMonthlyPlanRecord(plan) : null
}

export async function isMonthClosed(userId: string, month: string): Promise<boolean> {
  const snapshot = await findClosedSnapshot(userId, month)
  return Boolean(snapshot)
}

export async function assertMonthEditable(userId: string, month: string): Promise<void> {
  if (await isMonthClosed(userId, month)) {
    throw createError({
      statusCode: 423,
      statusMessage: `${month} is closed and cannot be edited.`
    })
  }
}

export function toPublicUser(user: UserRecord): UserPublic {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    currencyCode: user.currencyCode,
    createdAt: user.createdAt
  }
}

export async function findUserById(userId: string): Promise<UserRecord | undefined> {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    return user ? toUserRecord(user) : undefined
  }
  catch (error) {
    if (isMissingCurrencyColumnError(error)) {
      throwCurrencyMigrationError()
    }

    throw error
  }
}

export async function findUserByEmail(email: string): Promise<UserRecord | undefined> {
  const normalizedEmail = email.trim().toLowerCase()

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1)

    return user ? toUserRecord(user) : undefined
  }
  catch (error) {
    if (isMissingCurrencyColumnError(error)) {
      throwCurrencyMigrationError()
    }

    throw error
  }
}

export async function findUserByUsername(username: string): Promise<UserRecord | undefined> {
  const normalizedUsername = username.trim().toLowerCase()

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.usernameNormalized, normalizedUsername))
      .limit(1)

    return user ? toUserRecord(user) : undefined
  }
  catch (error) {
    if (isMissingCurrencyColumnError(error)) {
      throwCurrencyMigrationError()
    }

    throw error
  }
}

export async function createUser(
  email: string,
  username: string,
  passwordHash: string,
  currencyCode: CurrencyCode = 'USD'
): Promise<UserRecord> {
  const normalizedEmail = email.trim().toLowerCase()
  const normalizedUsername = username.trim().toLowerCase()

  try {
    const [user] = await db
      .insert(users)
      .values({
        id: randomUUID(),
        email: normalizedEmail,
        username,
        usernameNormalized: normalizedUsername,
        currencyCode,
        passwordHash
      })
      .returning()

    return toUserRecord(user)
  }
  catch (error) {
    if (isMissingCurrencyColumnError(error)) {
      throwCurrencyMigrationError()
    }

    throw error
  }
}

export async function listUserExpenses(userId: string, month?: string): Promise<ExpenseRecord[]> {
  const whereClause = month
    ? and(
        eq(expenses.userId, userId),
        gte(expenses.date, getMonthBounds(month).start),
        lt(expenses.date, getMonthBounds(month).nextStart)
      )
    : eq(expenses.userId, userId)

  const rows = await db
    .select()
    .from(expenses)
    .where(whereClause)
    .orderBy(desc(expenses.date), desc(expenses.createdAt))

  return rows.map(toExpenseRecord)
}

export async function createExpense(userId: string, input: ExpenseInput): Promise<ExpenseRecord> {
  const month = getMonthFromDateString(input.date)
  await assertMonthEditable(userId, month)

  const [expense] = await db
    .insert(expenses)
    .values({
      id: randomUUID(),
      userId,
      title: input.title,
      amount: input.amount,
      category: input.category,
      date: input.date,
      notes: input.notes || ''
    })
    .returning()

  return toExpenseRecord(expense)
}

export async function updateExpense(
  userId: string,
  expenseId: string,
  input: ExpenseInput
): Promise<ExpenseRecord | undefined> {
  const [existing] = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.id, expenseId), eq(expenses.userId, userId)))
    .limit(1)

  if (!existing) {
    return undefined
  }

  const existingMonth = getMonthFromDateString(existing.date)
  const nextMonth = getMonthFromDateString(input.date)

  await assertMonthEditable(userId, existingMonth)

  if (nextMonth !== existingMonth) {
    await assertMonthEditable(userId, nextMonth)
  }

  const [expense] = await db
    .update(expenses)
    .set({
      title: input.title,
      amount: input.amount,
      category: input.category,
      date: input.date,
      notes: input.notes || ''
    })
    .where(and(eq(expenses.id, expenseId), eq(expenses.userId, userId)))
    .returning()

  return expense ? toExpenseRecord(expense) : undefined
}

export async function deleteExpense(userId: string, expenseId: string): Promise<boolean> {
  const [existing] = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.id, expenseId), eq(expenses.userId, userId)))
    .limit(1)

  if (!existing) {
    return false
  }

  await assertMonthEditable(userId, getMonthFromDateString(existing.date))

  const deleted = await db
    .delete(expenses)
    .where(and(eq(expenses.id, expenseId), eq(expenses.userId, userId)))
    .returning({ id: expenses.id })

  return deleted.length > 0
}

export async function upsertMonthlyPlan(userId: string, input: MonthlyPlanInput): Promise<MonthlyPlanRecord> {
  await assertMonthEditable(userId, input.month)

  const existing = await findMonthlyPlan(userId, input.month)

  if (existing) {
    const [updated] = await db
      .update(monthlyPlans)
      .set({
        incomeAmount: input.incomeAmount,
        savingsTarget: input.savingsTarget,
        notes: input.notes || '',
        updatedAt: new Date()
      })
      .where(and(eq(monthlyPlans.userId, userId), eq(monthlyPlans.month, input.month)))
      .returning()

    return toMonthlyPlanRecord(updated)
  }

  const [created] = await db
    .insert(monthlyPlans)
    .values({
      id: randomUUID(),
      userId,
      month: input.month,
      incomeAmount: input.incomeAmount,
      savingsTarget: input.savingsTarget,
      notes: input.notes || ''
    })
    .returning()

  return toMonthlyPlanRecord(created)
}

export async function listUserMonthlySummaries(userId: string): Promise<MonthlySummary[]> {
  const [snapshotRows, expenseRows, planRows] = await Promise.all([
    db
      .select()
      .from(monthlySnapshots)
      .where(eq(monthlySnapshots.userId, userId))
      .orderBy(desc(monthlySnapshots.month)),
    db
      .select()
      .from(expenses)
      .where(eq(expenses.userId, userId))
      .orderBy(desc(expenses.date), desc(expenses.createdAt)),
    db
      .select()
      .from(monthlyPlans)
      .where(eq(monthlyPlans.userId, userId))
      .orderBy(desc(monthlyPlans.month))
  ])

  const summaryMap = new Map<string, MonthlySummary>()

  for (const snapshot of snapshotRows) {
    summaryMap.set(snapshot.month, {
      month: snapshot.month,
      totalAmount: roundMoney(snapshot.totalAmount),
      transactionCount: snapshot.transactionCount,
      topCategory: snapshot.topCategory,
      isClosed: snapshot.isClosed,
      closedAt: toIsoString(snapshot.closedAt)
    })
  }

  const groupedOpenMonths = new Map<string, ExpenseRecord[]>()
  for (const row of expenseRows) {
    const record = toExpenseRecord(row)
    const month = getMonthFromDateString(record.date)

    if (summaryMap.has(month)) {
      continue
    }

    const current = groupedOpenMonths.get(month) || []
    current.push(record)
    groupedOpenMonths.set(month, current)
  }

  for (const [month, records] of groupedOpenMonths) {
    const stats = computeMonthStats(records)
    summaryMap.set(month, {
      month,
      totalAmount: stats.totalAmount,
      transactionCount: stats.transactionCount,
      topCategory: stats.topCategory,
      isClosed: false,
      closedAt: null
    })
  }

  for (const plan of planRows) {
    if (summaryMap.has(plan.month)) {
      continue
    }

    summaryMap.set(plan.month, {
      month: plan.month,
      totalAmount: 0,
      transactionCount: 0,
      topCategory: 'No expenses yet',
      isClosed: false,
      closedAt: null
    })
  }

  return [...summaryMap.values()].sort((left, right) => right.month.localeCompare(left.month))
}

export async function listUserMonthlyTrend(userId: string, limit = 8): Promise<MonthlyTrendPoint[]> {
  const normalizedLimit = Math.min(24, Math.max(3, Math.trunc(limit) || 8))

  const [summaries, plans] = await Promise.all([
    listUserMonthlySummaries(userId),
    db
      .select()
      .from(monthlyPlans)
      .where(eq(monthlyPlans.userId, userId))
      .orderBy(desc(monthlyPlans.month))
  ])

  const summaryByMonth = new Map(summaries.map(summary => [summary.month, summary]))
  const planByMonth = new Map(plans.map(plan => [plan.month, toMonthlyPlanRecord(plan)]))

  const uniqueMonths = new Set<string>()
  for (const summary of summaries) {
    uniqueMonths.add(summary.month)
  }

  for (const plan of plans) {
    uniqueMonths.add(plan.month)
  }

  const months = [...uniqueMonths]
    .sort((left, right) => right.localeCompare(left))
    .slice(0, normalizedLimit)

  const trend = months.map((month) => {
    const summary = summaryByMonth.get(month)
    const plan = planByMonth.get(month)
    const expenseTotal = summary?.totalAmount || 0
    const incomeAmount = plan?.incomeAmount || 0
    const savingsTarget = plan?.savingsTarget || 0
    const plannedSpendable = roundMoney(Math.max(0, incomeAmount - savingsTarget))
    const remainingBudget = roundMoney(plannedSpendable - expenseTotal)

    return {
      month,
      expenseTotal: roundMoney(expenseTotal),
      incomeAmount: roundMoney(incomeAmount),
      savingsTarget: roundMoney(savingsTarget),
      plannedSpendable,
      remainingBudget,
      isClosed: summary?.isClosed || false
    }
  })

  return trend.reverse()
}

export async function getUserMonthlyDetail(userId: string, month: string): Promise<MonthlyDetail> {
  const [expensesForMonth, snapshot, plan] = await Promise.all([
    listUserExpenses(userId, month),
    findClosedSnapshot(userId, month),
    findMonthlyPlan(userId, month)
  ])

  if (snapshot) {
    const summary: MonthlySummary = {
      month: snapshot.month,
      totalAmount: roundMoney(snapshot.totalAmount),
      transactionCount: snapshot.transactionCount,
      topCategory: snapshot.topCategory,
      isClosed: snapshot.isClosed,
      closedAt: toIsoString(snapshot.closedAt)
    }

    return {
      summary,
      plan,
      budget: buildMonthlyBudgetInsights(month, summary.totalAmount, plan),
      categoryBreakdown: snapshot.categoryBreakdown,
      summaryText: snapshot.summaryText,
      expenses: expensesForMonth
    }
  }

  const stats = computeMonthStats(expensesForMonth)
  return {
    summary: {
      month,
      totalAmount: stats.totalAmount,
      transactionCount: stats.transactionCount,
      topCategory: stats.topCategory,
      isClosed: false,
      closedAt: null
    },
    plan,
    budget: buildMonthlyBudgetInsights(month, stats.totalAmount, plan),
    categoryBreakdown: stats.categoryBreakdown,
    summaryText: '',
    expenses: expensesForMonth
  }
}

export async function updateUserCurrency(userId: string, currencyCode: CurrencyCode): Promise<UserRecord | undefined> {
  try {
    const [updated] = await db
      .update(users)
      .set({
        currencyCode
      })
      .where(eq(users.id, userId))
      .returning()

    return updated ? toUserRecord(updated) : undefined
  }
  catch (error) {
    if (isMissingCurrencyColumnError(error)) {
      throwCurrencyMigrationError()
    }

    throw error
  }
}

export async function closeUserMonth(
  userId: string,
  month: string,
  currencyCode: CurrencyCode = 'USD'
): Promise<MonthlySnapshotRecord> {
  const existing = await findClosedSnapshot(userId, month)
  if (existing) {
    return toMonthlySnapshotRecord(existing)
  }

  const records = await listUserExpenses(userId, month)
  const stats = computeMonthStats(records)
  const summaryText = stats.transactionCount
    ? `Closed ${month} with ${stats.transactionCount} transactions and ${formatAmountForCurrency(stats.totalAmount, currencyCode)} total spend.`
    : `Closed ${month} with no transactions.`

  const [snapshot] = await db
    .insert(monthlySnapshots)
    .values({
      id: randomUUID(),
      userId,
      month,
      isClosed: true,
      totalAmount: stats.totalAmount,
      transactionCount: stats.transactionCount,
      topCategory: stats.topCategory,
      categoryBreakdown: stats.categoryBreakdown,
      summaryText
    })
    .returning()

  return toMonthlySnapshotRecord(snapshot)
}
