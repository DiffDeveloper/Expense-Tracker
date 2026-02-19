import { relations } from 'drizzle-orm'
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex
} from 'drizzle-orm/pg-core'

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    username: text('username').notNull(),
    usernameNormalized: text('username_normalized').notNull(),
    currencyCode: text('currency_code').notNull().default('USD'),
    passwordHash: text('password_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
  },
  (table) => ({
    emailUnique: uniqueIndex('users_email_unique').on(table.email),
    usernameNormalizedUnique: uniqueIndex('users_username_normalized_unique').on(table.usernameNormalized)
  })
)

export const expenses = pgTable(
  'expenses',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    amount: doublePrecision('amount').notNull(),
    category: text('category').notNull(),
    date: date('date', { mode: 'string' }).notNull(),
    notes: text('notes').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
  },
  (table) => ({
    userDateIdx: index('expenses_user_date_idx').on(table.userId, table.date),
    userCreatedIdx: index('expenses_user_created_idx').on(table.userId, table.createdAt)
  })
)

export const monthlySnapshots = pgTable(
  'monthly_snapshots',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    month: text('month').notNull(),
    isClosed: boolean('is_closed').notNull().default(true),
    totalAmount: doublePrecision('total_amount').notNull(),
    transactionCount: integer('transaction_count').notNull(),
    topCategory: text('top_category').notNull().default('None'),
    categoryBreakdown: jsonb('category_breakdown').$type<Record<string, number>>().notNull(),
    summaryText: text('summary_text').notNull().default(''),
    closedAt: timestamp('closed_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
  },
  (table) => ({
    userMonthUnique: uniqueIndex('monthly_snapshots_user_month_unique').on(table.userId, table.month),
    userClosedAtIdx: index('monthly_snapshots_user_closed_at_idx').on(table.userId, table.closedAt)
  })
)

export const monthlyPlans = pgTable(
  'monthly_plans',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    month: text('month').notNull(),
    incomeAmount: doublePrecision('income_amount').notNull().default(0),
    savingsTarget: doublePrecision('savings_target').notNull().default(0),
    notes: text('notes').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
  },
  (table) => ({
    userMonthUnique: uniqueIndex('monthly_plans_user_month_unique').on(table.userId, table.month),
    userUpdatedIdx: index('monthly_plans_user_updated_idx').on(table.userId, table.updatedAt)
  })
)

export const usersRelations = relations(users, ({ many }) => ({
  expenses: many(expenses),
  monthlySnapshots: many(monthlySnapshots),
  monthlyPlans: many(monthlyPlans)
}))

export const expensesRelations = relations(expenses, ({ one }) => ({
  user: one(users, {
    fields: [expenses.userId],
    references: [users.id]
  })
}))

export const monthlySnapshotsRelations = relations(monthlySnapshots, ({ one }) => ({
  user: one(users, {
    fields: [monthlySnapshots.userId],
    references: [users.id]
  })
}))

export const monthlyPlansRelations = relations(monthlyPlans, ({ one }) => ({
  user: one(users, {
    fields: [monthlyPlans.userId],
    references: [users.id]
  })
}))
