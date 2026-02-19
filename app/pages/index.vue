<script setup lang="ts">
import type { CurrencyCode, ExpenseRecord, MonthlyPlanRecord, MonthlySummary } from '~~/shared/types'

useHead({
  title: 'Diff Expense Tracker | Product Overview',
  meta: [
    {
      name: 'description',
      content: 'A modern expense tracker with monthly locking, AI coaching, and financial chart insights.'
    }
  ]
})

const sessionUser = ref<{ id: string, username: string, currencyCode: CurrencyCode } | null>(null)
const logoutBusy = ref(false)
const today = new Date().toISOString().slice(0, 10)
const currentMonth = today.slice(0, 7)

interface MonthlyDetailResponse {
  summary: MonthlySummary
  plan: MonthlyPlanRecord | null
  budget: {
    plannedSpendable: number
    remainingBudget: number
    daysRemaining: number
    dailyAllowance: number
    incomeRequired: boolean
  }
  categoryBreakdown: Record<string, number>
  summaryText: string
  expenses: ExpenseRecord[]
}

const monthDetail = ref<MonthlyDetailResponse | null>(null)

const featureHighlights = [
  {
    title: 'Monthly lock workflow',
    description: 'Close each month to preserve immutable records and prevent back-editing.'
  },
  {
    title: 'AI expense coach',
    description: 'Ask finance-relevant questions and get practical monthly action steps.'
  },
  {
    title: 'Financial chart layer',
    description: 'Track category mix, daily spending, and monthly income vs expense trends.'
  }
]

const usageSteps = [
  {
    title: 'Create account with username',
    description: 'Register with email and username so your dashboard feels personal.'
  },
  {
    title: 'Track expenses daily',
    description: 'Add categorized expenses in seconds for your selected month.'
  },
  {
    title: 'Set your monthly plan',
    description: 'Add income and savings target to unlock daily allowance guidance.'
  },
  {
    title: 'Close month and improve',
    description: 'Lock finalized months and use trend insights for the next cycle.'
  }
]

const previewTrend = [
  { label: 'Week 1', amount: 280 },
  { label: 'Week 2', amount: 320 },
  { label: 'Week 3', amount: 260 },
  { label: 'Week 4', amount: 388.5 }
]

const emptyTrend = [
  { label: 'Week 1', amount: 0 },
  { label: 'Week 2', amount: 0 },
  { label: 'Week 3', amount: 0 },
  { label: 'Week 4', amount: 0 }
]

const currentMonthLabel = new Intl.DateTimeFormat(undefined, {
  month: 'long',
  year: 'numeric'
}).format(new Date(`${currentMonth}-01T00:00:00Z`))

function roundMoney(value: number) {
  return Number(value.toFixed(2))
}

function getLocaleForCurrency(currencyCode: CurrencyCode): string {
  return currencyCode === 'THB' ? 'th-TH' : 'en-US'
}

const activeCurrencyCode = computed<CurrencyCode>(() => sessionUser.value?.currencyCode || 'USD')

function formatCurrency(amount: number) {
  return new Intl.NumberFormat(getLocaleForCurrency(activeCurrencyCode.value), {
    style: 'currency',
    currency: activeCurrencyCode.value,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

function buildWeeklyTrend(expenses: ExpenseRecord[]) {
  const buckets = [0, 0, 0, 0]

  for (const expense of expenses) {
    const day = Number.parseInt(expense.date.slice(8, 10), 10)

    if (Number.isNaN(day) || day < 1) {
      continue
    }

    const index = Math.min(3, Math.floor((day - 1) / 7))
    buckets[index] += expense.amount
  }

  return buckets.map((amount, index) => ({
    label: `Week ${index + 1}`,
    amount: roundMoney(amount)
  }))
}

const hasLiveOverview = computed(() => Boolean(sessionUser.value && monthDetail.value))

const hasLiveExpenses = computed(() => {
  return (monthDetail.value?.summary.transactionCount || 0) > 0
})

const liveOverview = computed(() => {
  if (!monthDetail.value) {
    return {
      monthTotal: 1248.5,
      transactionCount: 42,
      dailyAllowance: 41.6,
      todayRemainingText: `${formatCurrency(18.2)} left today`,
      topCategoryName: 'Food',
      topCategoryPercent: 32,
      trend: previewTrend
    }
  }

  const detail = monthDetail.value
  const hasExpenses = detail.summary.transactionCount > 0
  const categoryEntries = Object.entries(detail.categoryBreakdown)
    .sort((left, right) => right[1] - left[1])
  const totalByCategory = categoryEntries.reduce((sum, [, amount]) => sum + amount, 0)
  const topCategory = categoryEntries[0] || ['None', 0]
  const topCategoryPercent = totalByCategory > 0
    ? roundMoney((topCategory[1] / totalByCategory) * 100)
    : 0
  const todaySpent = detail.expenses
    .filter(expense => expense.date === today)
    .reduce((sum, expense) => sum + expense.amount, 0)
  const todayRemaining = roundMoney(detail.budget.dailyAllowance - todaySpent)
  const todayRemainingText = detail.budget.incomeRequired
    ? 'Set monthly income to unlock'
    : `${formatCurrency(todayRemaining)} left today`

  return {
    monthTotal: detail.summary.totalAmount,
    transactionCount: detail.summary.transactionCount,
    dailyAllowance: detail.budget.dailyAllowance,
    todayRemainingText,
    topCategoryName: hasExpenses ? topCategory[0] : 'No spending yet',
    topCategoryPercent,
    trend: hasExpenses ? buildWeeklyTrend(detail.expenses) : emptyTrend
  }
})

  const previewTrendMax = computed(() => {
  const maxValue = liveOverview.value.trend.reduce((max, item) => Math.max(max, item.amount), 0)
  return Math.max(1, maxValue)
})

try {
  const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
  const response = await $fetch<{ user: { id: string, username: string, currencyCode: CurrencyCode } | null }>('/api/auth/me', { headers })
  sessionUser.value = response.user

  if (sessionUser.value) {
    const detailResponse = await $fetch<{ month: MonthlyDetailResponse }>('/api/reports/monthly', {
      query: { month: currentMonth },
      headers
    })

    monthDetail.value = detailResponse.month
  }
}
catch {
  sessionUser.value = null
  monthDetail.value = null
}

async function logoutFromLanding() {
  logoutBusy.value = true

  try {
    await $fetch('/api/auth/logout', {
      method: 'POST'
    })

    sessionUser.value = null
    monthDetail.value = null
  }
  finally {
    logoutBusy.value = false
  }
}
</script>

<template>
  <main class="mx-auto grid w-full max-w-6xl gap-6 px-4 pb-16 pt-8 md:px-6">
    <section class="landing-hero ui-card-soft landing-reveal relative overflow-hidden p-6 md:p-8">
      <div class="landing-orb landing-orb-a"></div>
      <div class="landing-orb landing-orb-b"></div>

      <div class="relative grid gap-7 lg:grid-cols-[1.2fr_0.9fr] lg:items-center">
        <div>
          <p class="ui-chip">Smart Expense Control</p>
          <h1 class="mt-4 text-4xl leading-tight text-white md:text-5xl">
            <span class="text-white">Diff</span>
            <span class="theme-accent-text ml-2">Expense Tracker</span>
          </h1>
          <p class="mt-4 max-w-2xl text-sm text-zinc-300 md:text-base">
            Plan, track, lock, and improve your monthly spending with focused AI coaching and clean financial visuals.
          </p>

          <div v-if="sessionUser" class="theme-accent-soft mt-4 inline-flex rounded-full px-3 py-1 text-xs font-semibold">
            Signed in as @{{ sessionUser.username }}
          </div>

          <div class="mt-6 flex flex-wrap gap-3">
            <template v-if="sessionUser">
              <NuxtLink class="ui-btn-primary" to="/dashboard">
                Open Dashboard
              </NuxtLink>
              <button class="ui-btn-secondary" :disabled="logoutBusy" @click="logoutFromLanding">
                {{ logoutBusy ? 'Logging out...' : 'Logout' }}
              </button>
            </template>
            <template v-else>
              <NuxtLink class="ui-btn-primary" to="/auth">
                Get Started
              </NuxtLink>
              <NuxtLink class="ui-btn-secondary" to="/auth">
                Sign in / Create account
              </NuxtLink>
            </template>
          </div>
        </div>

        <aside class="landing-preview landing-float ui-card p-4 md:p-5">
          <div class="flex items-center justify-between gap-3">
            <p class="theme-accent-text text-xs font-semibold uppercase tracking-[0.16em]">Live Overview</p>
            <span v-if="hasLiveOverview" class="landing-live-badge">Live data</span>
          </div>
          <div class="mt-3 grid gap-3">
            <div class="landing-preview-card">
              <div class="flex items-end justify-between gap-3">
                <div>
                  <p class="text-xs text-zinc-400">This Month</p>
                  <p class="theme-value-text mt-1 text-2xl font-semibold">{{ formatCurrency(liveOverview.monthTotal) }}</p>
                </div>
                <p class="landing-metric-sub">{{ liveOverview.transactionCount }} transactions</p>
              </div>
            </div>

            <div class="landing-preview-card">
              <div class="flex items-end justify-between gap-3">
                <div>
                  <p class="text-xs text-zinc-400">Daily Allowance</p>
                  <p class="theme-value-text mt-1 text-lg font-semibold">{{ formatCurrency(liveOverview.dailyAllowance) }}</p>
                </div>
                <p class="landing-metric-sub">{{ liveOverview.todayRemainingText }}</p>
              </div>
            </div>

            <div class="landing-preview-card">
              <div class="flex items-center justify-between gap-3">
                <p class="text-sm text-zinc-300">Top Category · {{ liveOverview.topCategoryName }}</p>
                <p class="theme-value-text text-sm font-semibold">{{ liveOverview.topCategoryPercent.toFixed(0) }}%</p>
              </div>
              <div class="landing-progress-track mt-2">
                <span class="landing-progress-fill" :style="{ width: `${liveOverview.topCategoryPercent}%` }"></span>
              </div>
            </div>

            <div class="landing-preview-card">
              <p class="text-xs uppercase tracking-wide text-zinc-400">Weekly spend trend</p>
              <p v-if="hasLiveOverview && !hasLiveExpenses" class="landing-empty-note mt-2">
                No expenses logged for {{ currentMonthLabel }} yet. Add your first entry from Dashboard.
              </p>
              <ul v-else class="mt-2 grid gap-1.5">
                <li
                  v-for="item in liveOverview.trend"
                  :key="item.label"
                  class="landing-trend-row"
                >
                  <span class="text-xs text-zinc-400">{{ item.label }}</span>
                  <div class="landing-trend-track">
                    <span class="landing-trend-bar" :style="{ width: `${(item.amount / previewTrendMax) * 100}%` }"></span>
                  </div>
                  <span class="theme-value-text text-xs">{{ formatCurrency(item.amount) }}</span>
                </li>
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </section>

    <section class="grid gap-4 md:grid-cols-3">
      <article
        v-for="(feature, index) in featureHighlights"
        :key="feature.title"
        class="ui-card landing-reveal p-5"
        :style="{ animationDelay: `${index * 90 + 60}ms` }"
      >
        <h2 class="text-lg font-semibold text-white">{{ feature.title }}</h2>
        <p class="mt-2 text-sm text-zinc-400">{{ feature.description }}</p>
      </article>
    </section>

    <section class="ui-card landing-reveal p-5 md:p-6" style="animation-delay: 240ms">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <h2 class="text-2xl font-semibold text-white">How to use this tracker</h2>
        <p class="text-sm text-zinc-400">A simple monthly workflow in four steps.</p>
      </div>

      <div class="mt-4 grid gap-3 md:grid-cols-2">
        <article
          v-for="(step, index) in usageSteps"
          :key="step.title"
          class="landing-step-card rounded-xl border border-white/10 bg-white/[0.02] p-4"
        >
          <p class="theme-accent-text text-xs font-semibold uppercase tracking-wide">Step {{ index + 1 }}</p>
          <h3 class="mt-1 text-base font-semibold text-white">{{ step.title }}</h3>
          <p class="mt-1 text-sm text-zinc-400">{{ step.description }}</p>
        </article>
      </div>
    </section>
  </main>
</template>
