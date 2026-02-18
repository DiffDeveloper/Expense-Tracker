import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type {
  DatabaseSchema,
  ExpenseInput,
  ExpenseRecord,
  UserPublic,
  UserRecord
} from '~~/shared/types'

const DATABASE_VERSION = 1
const DATABASE_DIR = join(process.cwd(), 'data')
const DATABASE_FILE = join(DATABASE_DIR, 'store.json')

const defaultDatabase: DatabaseSchema = {
  version: DATABASE_VERSION,
  users: [],
  expenses: []
}

function ensureDatabaseFile() {
  if (!existsSync(DATABASE_DIR)) {
    mkdirSync(DATABASE_DIR, { recursive: true })
  }

  if (!existsSync(DATABASE_FILE)) {
    writeFileSync(DATABASE_FILE, JSON.stringify(defaultDatabase, null, 2), 'utf8')
  }
}

function readDatabase(): DatabaseSchema {
  ensureDatabaseFile()
  const rawContent = readFileSync(DATABASE_FILE, 'utf8')

  try {
    const parsed = JSON.parse(rawContent) as DatabaseSchema

    if (!Array.isArray(parsed.users) || !Array.isArray(parsed.expenses)) {
      return structuredClone(defaultDatabase)
    }

    return {
      version: Number(parsed.version) || DATABASE_VERSION,
      users: parsed.users,
      expenses: parsed.expenses
    }
  }
  catch {
    return structuredClone(defaultDatabase)
  }
}

function writeDatabase(database: DatabaseSchema) {
  writeFileSync(DATABASE_FILE, JSON.stringify(database, null, 2), 'utf8')
}

export function toPublicUser(user: UserRecord): UserPublic {
  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt
  }
}

export function findUserById(userId: string): UserRecord | undefined {
  const database = readDatabase()
  return database.users.find((user) => user.id === userId)
}

export function findUserByEmail(email: string): UserRecord | undefined {
  const normalizedEmail = email.trim().toLowerCase()
  const database = readDatabase()
  return database.users.find((user) => user.email === normalizedEmail)
}

export function createUser(email: string, passwordHash: string): UserRecord {
  const database = readDatabase()
  const normalizedEmail = email.trim().toLowerCase()

  const user: UserRecord = {
    id: randomUUID(),
    email: normalizedEmail,
    passwordHash,
    createdAt: new Date().toISOString()
  }

  database.users.push(user)
  writeDatabase(database)

  return user
}

export function listUserExpenses(userId: string): ExpenseRecord[] {
  const database = readDatabase()

  return database.expenses
    .filter((expense) => expense.userId === userId)
    .sort((left, right) => {
      const byDate = right.date.localeCompare(left.date)

      if (byDate !== 0) {
        return byDate
      }

      return right.createdAt.localeCompare(left.createdAt)
    })
}

export function createExpense(userId: string, input: ExpenseInput): ExpenseRecord {
  const database = readDatabase()

  const expense: ExpenseRecord = {
    id: randomUUID(),
    userId,
    title: input.title,
    amount: input.amount,
    category: input.category,
    date: input.date,
    notes: input.notes || '',
    createdAt: new Date().toISOString()
  }

  database.expenses.push(expense)
  writeDatabase(database)

  return expense
}

export function updateExpense(userId: string, expenseId: string, input: ExpenseInput): ExpenseRecord | undefined {
  const database = readDatabase()
  const expenseIndex = database.expenses.findIndex(
    (expense) => expense.id === expenseId && expense.userId === userId
  )

  if (expenseIndex === -1) {
    return undefined
  }

  const updatedExpense: ExpenseRecord = {
    ...database.expenses[expenseIndex],
    title: input.title,
    amount: input.amount,
    category: input.category,
    date: input.date,
    notes: input.notes || ''
  }

  database.expenses[expenseIndex] = updatedExpense
  writeDatabase(database)

  return updatedExpense
}

export function deleteExpense(userId: string, expenseId: string): boolean {
  const database = readDatabase()
  const nextExpenses = database.expenses.filter(
    (expense) => !(expense.id === expenseId && expense.userId === userId)
  )

  if (nextExpenses.length === database.expenses.length) {
    return false
  }

  database.expenses = nextExpenses
  writeDatabase(database)

  return true
}
