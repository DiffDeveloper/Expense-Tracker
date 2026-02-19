<script setup lang="ts">
import {
  EXPENSE_CATEGORIES,
  type CurrencyCode,
  type ExpenseRecord,
  type MonthlyPlanRecord,
  type MonthlySummary,
  type MonthlyTrendPoint,
  type UserPublic
} from '~~/shared/types'

definePageMeta({
  middleware: 'auth'
})

useHead({
  title: 'Diff Expense Tracker | Monthly Archive',
  meta: [
    {
      name: 'description',
      content: 'Track expenses month by month, close completed months, and review locked historical snapshots.'
    }
  ]
})

type FeedbackKind = 'success' | 'error' | 'info'
type DashboardTab = 'overview' | 'expenses' | 'plan-ai' | 'archive'

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

type ThemeOption = 'black-orange' | 'dark-white' | 'green-white'

const route = useRoute()
const router = useRouter()

function resolveDashboardTab(value: unknown): DashboardTab {
  const normalized = Array.isArray(value) ? value[0] : value

  if (normalized === 'overview' || normalized === 'expenses' || normalized === 'plan-ai' || normalized === 'archive') {
    return normalized
  }

  return 'overview'
}

const categories = [...EXPENSE_CATEGORIES]
const today = new Date().toISOString().slice(0, 10)
const currentMonth = today.slice(0, 7)

const loading = ref(true)
const expenseBusy = ref(false)
const aiBusy = ref(false)
const planBusy = ref(false)
const closeMonthBusy = ref(false)
const monthBusy = ref(false)
const currencyBusy = ref(false)

const user = ref<UserPublic | null>(null)
const expenses = ref<ExpenseRecord[]>([])
const monthSummaries = ref<MonthlySummary[]>([])
const monthlyTrend = ref<MonthlyTrendPoint[]>([])
const monthDetail = ref<MonthlyDetailResponse | null>(null)
const selectedMonth = ref(currentMonth)
const selectedTheme = ref<ThemeOption>('black-orange')
const activeTab = ref<DashboardTab>(resolveDashboardTab(route.query.tab))

const aiQuestion = ref('')
const aiResponse = ref<{
  source: 'openai' | 'fallback'
  answer: string
  actions: string[]
} | null>(null)

const quickQuestions = [
  'How much should I spend per day this month if I want to save 20% from my monthly income?',
  'Based on my recent data, how should I split my grocery budget for the rest of this month?',
  'What 3 actions should I take this month to reduce unnecessary spending without hurting essentials?'
]

const categoryPalette = computed(() => {
  if (selectedTheme.value === 'dark-white') {
    return ['#ffffff', '#ededed', '#d4d4d4', '#b8b8b8', '#989898', '#7a7a7a', '#5c5c5c']
  }

  if (selectedTheme.value === 'green-white') {
    return ['#44d69a', '#6ee7b7', '#a7f3d0', '#bbf7d0', '#34d399', '#86efac', '#99f6e4']
  }

  return ['#ff7a00', '#ff9b3d', '#ffd6ac', '#ffb86b', '#ff9830', '#fbbf24', '#fde68a']
})

const expenseForm = reactive({
  title: '',
  amount: '',
  category: categories[0],
  date: `${currentMonth}-01`,
  notes: ''
})

const planForm = reactive({
  incomeAmount: '',
  savingsTarget: '',
  notes: ''
})

const themeOptions: Array<{ value: ThemeOption, label: string, swatch: string }> = [
  {
    value: 'black-orange',
    label: 'Ember',
    swatch: 'linear-gradient(135deg, #ff7a00, #e35e00)'
  },
  {
    value: 'dark-white',
    label: 'Dark Neon',
    swatch: 'linear-gradient(135deg, #f7f7f7, #cfcfcf)'
  },
  {
    value: 'green-white',
    label: 'Mint Light',
    swatch: 'linear-gradient(135deg, #1fc67d, #9af2ca)'
  }
]

const currencyOptions: Array<{ value: CurrencyCode, label: string, description: string }> = [
  {
    value: 'USD',
    label: 'US Dollar (USD)',
    description: 'United States Dollar'
  },
  {
    value: 'THB',
    label: 'Thai Baht (THB)',
    description: 'Thai Baht'
  }
]

const dashboardTabs: Array<{ value: DashboardTab, label: string, description: string }> = [
  {
    value: 'overview',
    label: 'Overview',
    description: 'Month insights'
  },
  {
    value: 'expenses',
    label: 'Expenses',
    description: 'Track entries'
  },
  {
    value: 'plan-ai',
    label: 'Plan & AI',
    description: 'Guidance center'
  },
  {
    value: 'archive',
    label: 'Archive',
    description: 'Close and review'
  }
]

const feedback = ref<{ kind: FeedbackKind, message: string } | null>(null)

const selectedSummary = computed(() => {
  if (monthDetail.value) {
    return monthDetail.value.summary
  }

  return monthSummaries.value.find(summary => summary.month === selectedMonth.value) || {
    month: selectedMonth.value,
    totalAmount: 0,
    transactionCount: 0,
    topCategory: 'No expenses yet',
    isClosed: false,
    closedAt: null
  }
})

const isSelectedMonthClosed = computed(() => selectedSummary.value.isClosed)

const selectedPlan = computed(() => monthDetail.value?.plan || null)

const selectedBudget = computed(() => {
  return monthDetail.value?.budget || {
    plannedSpendable: 0,
    remainingBudget: 0,
    daysRemaining: 0,
    dailyAllowance: 0,
    incomeRequired: true
  }
})

function toNumberOrZero(value: string | number | null | undefined) {
  const raw = typeof value === 'number' ? value : Number.parseFloat(value || '0')
  return Number.isFinite(raw) ? raw : 0
}

const draftIncomeAmount = computed(() => toNumberOrZero(planForm.incomeAmount))
const draftSavingsTarget = computed(() => toNumberOrZero(planForm.savingsTarget))

const hasMonthlyIncome = computed(() => {
  return (selectedPlan.value?.incomeAmount || 0) > 0
})

const canSaveMonthlyPlan = computed(() => {
  if (isSelectedMonthClosed.value || planBusy.value) {
    return false
  }

  if (draftIncomeAmount.value <= 0) {
    return false
  }

  if (draftSavingsTarget.value < 0 || draftSavingsTarget.value > draftIncomeAmount.value) {
    return false
  }

  return true
})

const categorySnapshot = computed(() => {
  if (!monthDetail.value) {
    return [] as Array<[string, number]>
  }

  return Object.entries(monthDetail.value.categoryBreakdown)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
})

const monthOptions = computed(() => {
  const uniqueMonths = new Set([currentMonth, selectedMonth.value])

  for (const summary of monthSummaries.value) {
    uniqueMonths.add(summary.month)
  }

  return [...uniqueMonths].sort((left, right) => right.localeCompare(left))
})

const monthSelectOptions = computed(() => {
  return monthOptions.value.map(month => ({
    value: month,
    label: formatMonthLabel(month)
  }))
})

const themeSelectOptions = computed(() => {
  return themeOptions.map(option => ({
    value: option.value,
    label: option.label,
    swatch: option.swatch
  }))
})

const currencySelectOptions = computed(() => {
  return currencyOptions.map(option => ({
    value: option.value,
    label: option.label,
    description: option.description
  }))
})

const activeCurrencyCode = computed<CurrencyCode>(() => user.value?.currencyCode || 'USD')

const activeCurrencyFormatter = computed(() => {
  const locale = activeCurrencyCode.value === 'THB' ? 'th-TH' : 'en-US'

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: activeCurrencyCode.value,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
})

function formatMoney(amount: number): string {
  return activeCurrencyFormatter.value.format(amount)
}

const categorySelectOptions = computed(() => {
  return categories.map(category => ({
    value: category,
    label: category
  }))
})

const monthRange = computed(() => getMonthBounds(selectedMonth.value))

const categoryBreakdownEntries = computed(() => {
  if (!monthDetail.value) {
    return [] as Array<[string, number]>
  }

  return Object.entries(monthDetail.value.categoryBreakdown)
    .sort((left, right) => right[1] - left[1])
})

const totalCategoryAmount = computed(() => {
  return categoryBreakdownEntries.value.reduce((sum, [, amount]) => sum + amount, 0)
})

const categoryChartSegments = computed(() => {
  if (!categoryBreakdownEntries.value.length || totalCategoryAmount.value <= 0) {
    return [] as Array<{
      category: string
      amount: number
      percent: number
      color: string
      start: number
      end: number
    }>
  }

  let cursor = 0

  return categoryBreakdownEntries.value.map(([category, amount], index) => {
    const percent = (amount / totalCategoryAmount.value) * 100
    const start = cursor
    const end = cursor + percent
    cursor = end

    return {
      category,
      amount,
      percent,
      color: categoryPalette.value[index % categoryPalette.value.length],
      start,
      end
    }
  })
})

const categoryDonutStyle = computed(() => {
  if (!categoryChartSegments.value.length) {
    return {
      background: 'conic-gradient(rgba(255,255,255,0.18) 0% 100%)'
    }
  }

  const gradient = categoryChartSegments.value
    .map(segment => `${segment.color} ${segment.start.toFixed(2)}% ${segment.end.toFixed(2)}%`)
    .join(', ')

  return {
    background: `conic-gradient(${gradient})`
  }
})

const positiveDailyAllowance = computed(() => {
  return Math.max(0, selectedBudget.value.dailyAllowance)
})

const dailySpendSeries = computed(() => {
  const daysInMonth = Number.parseInt(monthRange.value.end.slice(8), 10)
  const totals = new Array<number>(daysInMonth).fill(0)

  for (const expense of expenses.value) {
    const day = Number.parseInt(expense.date.slice(8), 10)

    if (day >= 1 && day <= daysInMonth) {
      totals[day - 1] += expense.amount
    }
  }

  return totals.map((total, index) => ({
    day: index + 1,
    total: Number(total.toFixed(2))
  }))
})

const dailyChartMax = computed(() => {
  const maxDaily = dailySpendSeries.value.reduce((max, point) => Math.max(max, point.total), 0)
  return Math.max(1, maxDaily, positiveDailyAllowance.value)
})

const dailySeriesWithScale = computed(() => {
  return dailySpendSeries.value.map(point => ({
    ...point,
    height: Math.max(2, (point.total / dailyChartMax.value) * 100),
    isHigh: point.total > positiveDailyAllowance.value && positiveDailyAllowance.value > 0
  }))
})

const dailyAllowanceLine = computed(() => {
  if (positiveDailyAllowance.value <= 0) {
    return 0
  }

  return (positiveDailyAllowance.value / dailyChartMax.value) * 100
})

const monthlyTrendMax = computed(() => {
  const highestValue = monthlyTrend.value.reduce((max, point) => {
    return Math.max(max, point.expenseTotal, point.incomeAmount, point.plannedSpendable)
  }, 0)

  return Math.max(1, highestValue)
})

const monthlyTrendSeries = computed(() => {
  return monthlyTrend.value.map(point => ({
    ...point,
    label: formatShortMonth(point.month),
    expenseHeight: Math.max(2, (point.expenseTotal / monthlyTrendMax.value) * 100),
    incomeHeight: point.incomeAmount > 0
      ? Math.max(2, (point.incomeAmount / monthlyTrendMax.value) * 100)
      : 0
  }))
})

function setFeedback(kind: FeedbackKind, message: string) {
  feedback.value = { kind, message }
}

function getErrorMessage(error: unknown) {
  const statusMessage = (error as { data?: { statusMessage?: string } })?.data?.statusMessage
  if (statusMessage) {
    return statusMessage
  }

  const message = (error as Error)?.message
  return message || 'Something went wrong. Please try again.'
}

function getMonthBounds(month: string) {
  const [yearString, monthString] = month.split('-')
  const year = Number.parseInt(yearString, 10)
  const monthNumber = Number.parseInt(monthString, 10)

  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  const nextYear = monthNumber === 12 ? year + 1 : year
  const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1

  return {
    start: `${month}-01`,
    end: `${month}-${String(lastDay).padStart(2, '0')}`,
    nextStart: `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
  }
}

function addMonths(month: string, offset: number): string {
  const [yearString, monthString] = month.split('-')
  const date = new Date(Date.UTC(Number.parseInt(yearString, 10), Number.parseInt(monthString, 10) - 1 + offset, 1))

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function formatMonthLabel(month: string): string {
  const date = new Date(`${month}-01T00:00:00Z`)
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(date)
}

function formatShortMonth(month: string): string {
  const date = new Date(`${month}-01T00:00:00Z`)
  return new Intl.DateTimeFormat(undefined, { month: 'short' }).format(date)
}

function formatClosedAt(value: string | null): string {
  if (!value) {
    return 'Open month'
  }

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(new Date(value))
}

function applyTheme(theme: ThemeOption) {
  if (import.meta.client) {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('diff-theme', theme)
  }
}

function initializeTheme() {
  if (!import.meta.client) {
    return
  }

  const storedTheme = localStorage.getItem('diff-theme') as ThemeOption | null
  if (storedTheme && themeOptions.some(option => option.value === storedTheme)) {
    selectedTheme.value = storedTheme
  }

  applyTheme(selectedTheme.value)
}

function syncPlanFormWithMonthDetail() {
  const plan = monthDetail.value?.plan

  planForm.incomeAmount = plan ? String(plan.incomeAmount) : ''
  planForm.savingsTarget = plan ? String(plan.savingsTarget) : ''
  planForm.notes = plan?.notes || ''
}

async function setActiveTab(tab: DashboardTab) {
  if (tab === activeTab.value) {
    return
  }

  activeTab.value = tab

  const nextQuery = {
    ...route.query
  } as Record<string, string | string[]>

  if (tab === 'overview') {
    delete nextQuery.tab
  }
  else {
    nextQuery.tab = tab
  }

  await router.replace({
    query: nextQuery
  })
}

function updateTheme(themeValue: string) {
  const match = themeOptions.find(option => option.value === themeValue)

  if (match) {
    selectedTheme.value = match.value
  }
}

async function updateCurrencyPreference(currencyValue: string) {
  if (!user.value) {
    return
  }

  const match = currencyOptions.find(option => option.value === currencyValue)

  if (!match || user.value.currencyCode === match.value) {
    return
  }

  const previousCurrency = user.value.currencyCode
  user.value = {
    ...user.value,
    currencyCode: match.value
  }

  currencyBusy.value = true

  try {
    const response = await $fetch<{ user: UserPublic }>('/api/user/preferences', {
      method: 'PUT',
      body: {
        currencyCode: match.value
      }
    })

    user.value = response.user
    setFeedback('success', `Currency changed to ${match.label}.`)
  }
  catch (error) {
    if (user.value) {
      user.value = {
        ...user.value,
        currencyCode: previousCurrency
      }
    }
    setFeedback('error', getErrorMessage(error))
  }
  finally {
    currencyBusy.value = false
  }
}

function updateExpenseCategory(value: string) {
  expenseForm.category = value as (typeof EXPENSE_CATEGORIES)[number]
}

function updateExpenseDate(value: string) {
  expenseForm.date = value
}

function questionNeedsIncomeContext(question: string) {
  const lowered = question.toLowerCase()
  const incomeKeywords = ['income', 'salary', 'save', 'saving', 'daily', 'per day', 'allowance', 'how much can i spend']

  return incomeKeywords.some(keyword => lowered.includes(keyword))
}

function alignExpenseDateToSelectedMonth() {
  if (!expenseForm.date.startsWith(selectedMonth.value)) {
    expenseForm.date = `${selectedMonth.value}-01`
  }
}

function resetExpenseForm() {
  expenseForm.title = ''
  expenseForm.amount = ''
  expenseForm.category = categories[0]
  expenseForm.date = `${selectedMonth.value}-01`
  expenseForm.notes = ''
}

async function refreshSession() {
  const response = await $fetch<{ user: UserPublic | null }>('/api/auth/me')
  user.value = response.user
}

async function loadMonthSummaries() {
  if (!user.value) {
    monthSummaries.value = []
    return
  }

  const response = await $fetch<{ months: MonthlySummary[] }>('/api/reports/months')
  monthSummaries.value = response.months
}

async function loadMonthlyTrend() {
  if (!user.value) {
    monthlyTrend.value = []
    return
  }

  const response = await $fetch<{ points: MonthlyTrendPoint[] }>('/api/reports/trend?months=8')
  monthlyTrend.value = response.points
}

async function loadMonthDetail() {
  if (!user.value) {
    monthDetail.value = null
    expenses.value = []
    syncPlanFormWithMonthDetail()
    return
  }

  const response = await $fetch<{ month: MonthlyDetailResponse }>(`/api/reports/monthly?month=${selectedMonth.value}`)
  monthDetail.value = response.month
  expenses.value = response.month.expenses
  syncPlanFormWithMonthDetail()
}

async function askAiAdvice() {
  if (!user.value) {
    return
  }

  if (!aiQuestion.value.trim()) {
    setFeedback('error', 'Please ask an expense question first.')
    return
  }

  if (questionNeedsIncomeContext(aiQuestion.value) && !hasMonthlyIncome.value) {
    setFeedback('error', 'Add monthly income first to get daily allowance and savings planning advice.')
    return
  }

  aiBusy.value = true
  try {
    const response = await $fetch<{
      source: 'openai' | 'fallback'
      answer: string
      actions: string[]
    }>('/api/ai/advice', {
      method: 'POST',
      body: {
        question: aiQuestion.value,
        month: selectedMonth.value
      }
    })

    aiResponse.value = {
      source: response.source,
      answer: response.answer,
      actions: response.actions
    }
  }
  catch (error) {
    setFeedback('error', getErrorMessage(error))
  }
  finally {
    aiBusy.value = false
  }
}

async function askQuickQuestion(question: string) {
  aiQuestion.value = question
  await askAiAdvice()
}

async function refreshMonthWorkspace() {
  monthBusy.value = true
  aiResponse.value = null
  try {
    await loadMonthDetail()
  }
  finally {
    monthBusy.value = false
  }
}

async function initializeAuthenticatedWorkspace() {
  await Promise.all([
    loadMonthSummaries(),
    loadMonthlyTrend()
  ])
  alignExpenseDateToSelectedMonth()
  await refreshMonthWorkspace()
}

async function selectMonth(month: string) {
  if (month === selectedMonth.value) {
    return
  }

  selectedMonth.value = month
  alignExpenseDateToSelectedMonth()
  await refreshMonthWorkspace()
}

async function shiftMonth(offset: number) {
  await selectMonth(addMonths(selectedMonth.value, offset))
}

async function closeSelectedMonth() {
  closeMonthBusy.value = true

  try {
    await $fetch('/api/reports/monthly/close', {
      method: 'POST',
      body: {
        month: selectedMonth.value
      }
    })

    await Promise.all([
      loadMonthSummaries(),
      loadMonthlyTrend()
    ])
    await refreshMonthWorkspace()
    setFeedback('success', `${formatMonthLabel(selectedMonth.value)} is now closed and locked.`)
  }
  catch (error) {
    setFeedback('error', getErrorMessage(error))
  }
  finally {
    closeMonthBusy.value = false
  }
}

async function saveMonthlyPlan() {
  if (isSelectedMonthClosed.value) {
    setFeedback('error', `${formatMonthLabel(selectedMonth.value)} is closed and cannot be edited.`)
    return
  }

  if (draftIncomeAmount.value <= 0) {
    setFeedback('error', 'Monthly income must be greater than 0 before saving your plan.')
    return
  }

  if (draftSavingsTarget.value > draftIncomeAmount.value) {
    setFeedback('error', 'Savings target cannot be greater than monthly income.')
    return
  }

  planBusy.value = true
  try {
    await $fetch('/api/reports/monthly/plan', {
      method: 'PUT',
      body: {
        month: selectedMonth.value,
        incomeAmount: Number(draftIncomeAmount.value.toFixed(2)),
        savingsTarget: Number(draftSavingsTarget.value.toFixed(2)),
        notes: planForm.notes
      }
    })

    await Promise.all([
      refreshMonthWorkspace(),
      loadMonthSummaries(),
      loadMonthlyTrend()
    ])
    setFeedback('success', `Monthly plan saved for ${formatMonthLabel(selectedMonth.value)}.`)
  }
  catch (error) {
    setFeedback('error', getErrorMessage(error))
  }
  finally {
    planBusy.value = false
  }
}

async function submitExpense() {
  if (isSelectedMonthClosed.value) {
    setFeedback('error', `${formatMonthLabel(selectedMonth.value)} is closed and cannot be edited.`)
    return
  }

  if (!expenseForm.date.startsWith(selectedMonth.value)) {
    setFeedback('error', `Date must stay within ${formatMonthLabel(selectedMonth.value)}.`)
    return
  }

  expenseBusy.value = true

  try {
    await $fetch('/api/expenses', {
      method: 'POST',
      body: {
        title: expenseForm.title,
        amount: Number(expenseForm.amount),
        category: expenseForm.category,
        date: expenseForm.date,
        notes: expenseForm.notes
      }
    })

    await Promise.all([
      loadMonthSummaries(),
      loadMonthlyTrend()
    ])
    await refreshMonthWorkspace()
    resetExpenseForm()
    setFeedback('success', 'Expense added successfully.')
  }
  catch (error) {
    setFeedback('error', getErrorMessage(error))
  }
  finally {
    expenseBusy.value = false
  }
}

async function removeExpense(expenseId: string) {
  if (isSelectedMonthClosed.value) {
    setFeedback('error', `${formatMonthLabel(selectedMonth.value)} is closed and cannot be edited.`)
    return
  }

  try {
    await $fetch(`/api/expenses/${expenseId}`, {
      method: 'DELETE'
    })

    await Promise.all([
      loadMonthSummaries(),
      loadMonthlyTrend()
    ])
    await refreshMonthWorkspace()
    setFeedback('info', 'Expense removed.')
  }
  catch (error) {
    setFeedback('error', getErrorMessage(error))
  }
}

async function logout() {
  await $fetch('/api/auth/logout', {
    method: 'POST'
  })

  user.value = null
  monthDetail.value = null
  monthSummaries.value = []
  monthlyTrend.value = []
  expenses.value = []
  syncPlanFormWithMonthDetail()
  aiQuestion.value = ''
  aiResponse.value = null
  selectedMonth.value = currentMonth
  resetExpenseForm()
  setFeedback('info', 'You are logged out.')
  await navigateTo('/auth')
}

watch(selectedTheme, (theme) => {
  applyTheme(theme)
})

watch(() => route.query.tab, (tabValue) => {
  const resolved = resolveDashboardTab(tabValue)

  if (resolved !== activeTab.value) {
    activeTab.value = resolved
  }
})

initializeTheme()

await refreshSession()
if (!user.value) {
  await navigateTo('/auth')
}
else {
  await initializeAuthenticatedWorkspace()
}
loading.value = false
</script>

<template>
  <main class="mx-auto grid w-full max-w-6xl gap-4 px-4 pb-14 pt-5 md:px-6 md:pt-8">
    <section class="ui-card-soft p-5 md:p-6">
      <p class="ui-chip">Monthly Locked Ledger</p>
      <h1 class="mt-3 text-3xl leading-none sm:text-4xl md:text-5xl">
        <span class="text-white">Diff</span>
        <span class="theme-accent-text ml-2">Expense Tracker</span>
      </h1>
      <p class="mt-3 max-w-2xl text-sm text-zinc-300 sm:text-base">
        Track by month, close completed periods, and keep a permanent locked archive of your historical spend.
      </p>
    </section>

    <section
      v-if="feedback"
      class="rounded-xl px-4 py-3 text-sm"
      :class="{
        'ui-feedback-success': feedback.kind === 'success',
        'ui-feedback-error': feedback.kind === 'error',
        'ui-feedback-info': feedback.kind === 'info'
      }"
    >
      {{ feedback.message }}
    </section>

    <section v-if="loading" class="ui-card p-5 text-sm text-zinc-300">
      Loading your workspace...
    </section>

    <template v-else-if="user">
      <section class="ui-card relative z-30 flex flex-col gap-4 overflow-visible p-5 md:p-6">
        <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 class="text-2xl font-semibold text-white">Welcome back</h2>
            <p class="mt-1 text-sm text-zinc-400">{{ user.username }} · Review and lock each month once finalized.</p>
          </div>
          <button class="ui-btn-secondary" @click="logout">Log out</button>
        </div>

        <div class="grid gap-3 xl:grid-cols-[1fr_auto_auto_auto] xl:items-end">
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button class="ui-btn-secondary" @click="shiftMonth(-1)">
              Previous month
            </button>
            <button class="ui-btn-secondary" @click="shiftMonth(1)">
              Next month
            </button>
          </div>

          <label class="grid min-w-[220px] gap-1 text-sm text-zinc-300">
            Selected month
            <UiSelect
              :model-value="selectedMonth"
              :options="monthSelectOptions"
              mobile-title="Choose Month"
              @update:model-value="selectMonth"
            />
          </label>

          <label class="grid min-w-[190px] gap-1 text-sm text-zinc-300">
            Theme
            <UiSelect
              :model-value="selectedTheme"
              :options="themeSelectOptions"
              mobile-title="Choose Theme"
              @update:model-value="updateTheme"
            />
          </label>

          <label class="grid min-w-[210px] gap-1 text-sm text-zinc-300">
            Currency
            <UiSelect
              :model-value="activeCurrencyCode"
              :options="currencySelectOptions"
              :disabled="currencyBusy"
              mobile-title="Choose Currency"
              @update:model-value="updateCurrencyPreference"
            />
          </label>
        </div>

        <p class="text-sm text-zinc-400">
          Status:
          <strong class="text-zinc-200">{{ isSelectedMonthClosed ? 'Closed (locked)' : 'Open (editable)' }}</strong>
          ·
          {{ formatClosedAt(selectedSummary.closedAt) }}
        </p>
      </section>

      <section class="ui-card sticky top-3 z-20 overflow-x-auto p-2">
        <div class="flex min-w-max gap-2" role="tablist" aria-label="Dashboard sections">
          <button
            v-for="tab in dashboardTabs"
            :id="`tab-${tab.value}`"
            :key="tab.value"
            type="button"
            role="tab"
            class="rounded-xl border px-4 py-2 text-left transition"
            :aria-selected="activeTab === tab.value"
            :aria-controls="`panel-${tab.value}`"
            :class="activeTab === tab.value
              ? 'theme-accent-soft border-transparent'
              : 'border-white/10 bg-white/[0.02] text-zinc-300 hover:bg-white/[0.05]'"
            @click="setActiveTab(tab.value)"
          >
            <p class="text-sm font-semibold">{{ tab.label }}</p>
            <p class="text-[11px] text-zinc-400">{{ tab.description }}</p>
          </button>
        </div>
      </section>

      <section
        v-if="activeTab === 'overview'"
        id="panel-overview"
        role="tabpanel"
        aria-labelledby="tab-overview"
        class="grid gap-4"
      >
        <section class="grid gap-4 md:grid-cols-3">
          <article class="ui-card p-5">
            <h3 class="text-sm font-medium text-zinc-400">Selected month total</h3>
            <p class="mt-2 text-3xl font-semibold text-white">{{ formatMoney(selectedSummary.totalAmount) }}</p>
          </article>
          <article class="ui-card p-5">
            <h3 class="text-sm font-medium text-zinc-400">Transactions</h3>
            <p class="mt-2 text-3xl font-semibold text-white">{{ selectedSummary.transactionCount }}</p>
          </article>
          <article class="ui-card p-5">
            <h3 class="text-sm font-medium text-zinc-400">Top category</h3>
            <p class="mt-2 text-2xl font-semibold text-white">{{ selectedSummary.topCategory }}</p>
          </article>
        </section>

        <section class="grid items-start gap-4 xl:grid-cols-3">
          <article class="ui-card p-5 md:p-6">
            <h3 class="text-xl font-semibold text-white">Category distribution</h3>
            <p class="mt-1 text-sm text-zinc-400">Share of each category for {{ formatMonthLabel(selectedMonth) }}</p>

            <div v-if="categoryChartSegments.length" class="mt-4 grid gap-4">
              <div class="relative mx-auto h-44 w-44 rounded-full" :style="categoryDonutStyle">
                <div class="theme-donut-center absolute inset-[20%] grid place-items-center rounded-full text-center">
                  <p class="text-xs uppercase tracking-wide text-zinc-400">Total</p>
                  <p class="theme-value-text text-lg font-semibold">{{ formatMoney(totalCategoryAmount) }}</p>
                </div>
              </div>

              <ul class="grid gap-2">
                <li
                  v-for="segment in categoryChartSegments.slice(0, 6)"
                  :key="segment.category"
                  class="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-sm"
                >
                  <div class="flex items-start justify-between gap-3">
                    <span class="flex min-w-0 items-center gap-2 text-zinc-300">
                      <span class="h-2.5 w-2.5 rounded-full" :style="{ backgroundColor: segment.color }"></span>
                      <span class="truncate" :title="segment.category">{{ segment.category }}</span>
                    </span>
                    <span class="theme-value-text shrink-0 font-medium">{{ formatMoney(segment.amount) }}</span>
                  </div>
                  <div class="mt-1 text-xs text-zinc-400">
                    Share <span class="theme-value-text">{{ segment.percent.toFixed(1) }}%</span>
                  </div>
                </li>
              </ul>
            </div>

            <p v-else class="mt-4 text-sm text-zinc-500">Add expenses this month to visualize category mix.</p>
          </article>

          <article class="ui-card p-5 md:p-6 xl:col-span-2">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 class="text-xl font-semibold text-white">Monthly financial trend</h3>
                <p class="mt-1 text-sm text-zinc-400">Income vs expenses for the latest months</p>
              </div>
              <div class="flex items-center gap-3 text-xs text-zinc-300">
                <span class="inline-flex items-center gap-1.5">
                  <span class="chart-legend-income inline-block h-2.5 w-2.5 rounded-full"></span>
                  Income
                </span>
                <span class="inline-flex items-center gap-1.5">
                  <span class="chart-legend-expense inline-block h-2.5 w-2.5 rounded-full"></span>
                  Expense
                </span>
              </div>
            </div>

            <div v-if="monthlyTrendSeries.length" class="mt-4 overflow-x-auto pb-2">
              <div class="flex min-w-max items-end gap-3">
                <div v-for="point in monthlyTrendSeries" :key="point.month" class="w-14 text-center sm:w-16">
                  <div
                    class="relative mx-auto flex h-44 w-12 items-end justify-center gap-1 rounded-lg border border-white/10 bg-white/[0.02] px-1 py-2 sm:h-48 sm:w-14 md:h-52"
                  >
                    <div
                      class="chart-income-bar w-3 rounded-t"
                      :style="{ height: `${point.incomeHeight}%` }"
                      :title="`Income: ${formatMoney(point.incomeAmount)}`"
                    ></div>
                    <div
                      class="chart-expense-bar w-3 rounded-t"
                      :style="{ height: `${point.expenseHeight}%` }"
                      :title="`Expense: ${formatMoney(point.expenseTotal)}`"
                    ></div>
                  </div>
                  <p class="mt-2 text-xs text-zinc-400">{{ point.label }}</p>
                </div>
              </div>
            </div>

            <p v-else class="mt-4 text-sm text-zinc-500">Not enough history yet. Add expenses over multiple months to see trend charts.</p>
          </article>
        </section>

        <section class="ui-card p-5 md:p-6">
          <h3 class="text-xl font-semibold text-white">Daily spend chart</h3>
          <p class="mt-1 text-sm text-zinc-400">
            {{ hasMonthlyIncome
              ? `Daily allowance is ${formatMoney(selectedBudget.dailyAllowance)} based on your current monthly plan.`
              : 'Add monthly income to unlock daily allowance guidance. Expense bars still work without income.' }}
          </p>

          <div class="mt-4">
            <div class="relative h-48 rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <div
                v-if="dailyAllowanceLine > 0"
                class="theme-allowance-line absolute left-3 right-3 border-t border-dashed"
                :style="{ bottom: `${dailyAllowanceLine}%` }"
              ></div>

              <div class="flex h-full items-end gap-1">
                <div
                  v-for="point in dailySeriesWithScale"
                  :key="point.day"
                  class="group flex min-w-0 flex-1 flex-col justify-end"
                >
                  <div
                    class="w-full rounded-t transition group-hover:opacity-85"
                    :class="point.isHigh ? 'bg-red-400/85' : 'chart-expense-bar'"
                    :style="{ height: `${point.height}%` }"
                    :title="`Day ${point.day}: ${formatMoney(point.total)}`"
                  ></div>
                </div>
              </div>
            </div>

            <div class="mt-2 flex items-center justify-between text-xs text-zinc-500">
              <span>Day 1</span>
              <span>Mid-month</span>
              <span>Day {{ dailySeriesWithScale.length }}</span>
            </div>
          </div>
        </section>

        <section class="grid gap-4 xl:grid-cols-2">
          <article class="ui-card p-5 md:p-6">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <h3 class="text-xl font-semibold text-white">Plan snapshot</h3>
              <button class="ui-btn-secondary" @click="setActiveTab('plan-ai')">Open Plan & AI</button>
            </div>

            <p class="mt-2 text-sm text-zinc-400">Quick budget status for {{ formatMonthLabel(selectedMonth) }}.</p>

            <div class="mt-4 grid gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-sm">
              <p v-if="selectedBudget.incomeRequired" class="theme-accent-text text-xs">
                Add monthly income in Plan & AI to unlock full budget guidance.
              </p>
              <p class="text-zinc-300">Planned spendable: <strong class="text-white">{{ formatMoney(selectedBudget.plannedSpendable) }}</strong></p>
              <p class="text-zinc-300">Remaining budget: <strong class="text-white">{{ formatMoney(selectedBudget.remainingBudget) }}</strong></p>
              <p class="text-zinc-300">Days remaining: <strong class="text-white">{{ selectedBudget.daysRemaining }}</strong></p>
              <p class="text-zinc-300">Daily allowance: <strong class="text-white">{{ formatMoney(selectedBudget.dailyAllowance) }}</strong></p>
            </div>
          </article>

          <article class="ui-card p-5 md:p-6">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <h3 class="text-xl font-semibold text-white">Quick AI Advice</h3>
              <div class="flex flex-wrap gap-2">
                <button class="ui-btn-secondary" :disabled="aiBusy || monthBusy || !aiQuestion.trim()" @click="askAiAdvice">
                  {{ aiBusy ? 'Analyzing...' : 'Ask AI' }}
                </button>
                <button class="ui-btn-secondary" @click="setActiveTab('plan-ai')">Open full coach</button>
              </div>
            </div>

            <label class="mt-3 grid gap-1.5 text-sm text-zinc-200">
              Your question
              <textarea
                v-model="aiQuestion"
                class="ui-input min-h-24"
                placeholder="Example: How much can I spend daily this month if I want to save 300 from my income?"
                maxlength="500"
              ></textarea>
            </label>

            <div class="mt-3 flex flex-wrap gap-2">
              <button
                v-for="question in quickQuestions.slice(0, 2)"
                :key="question"
                class="theme-accent-hover rounded-full border border-white/15 bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-300 transition"
                @click="askQuickQuestion(question)"
              >
                {{ question }}
              </button>
            </div>

            <div v-if="aiResponse" class="theme-accent-panel mt-4 rounded-xl p-3">
              <p class="text-sm text-zinc-100">{{ aiResponse.answer }}</p>
            </div>
            <p v-else class="mt-4 text-sm text-zinc-500">
              Ask a budget or expense question to get quick guidance here.
            </p>
          </article>
        </section>
      </section>

      <section
        v-else-if="activeTab === 'expenses'"
        id="panel-expenses"
        role="tabpanel"
        aria-labelledby="tab-expenses"
        class="grid gap-4 xl:grid-cols-[340px_1fr]"
      >
        <article class="ui-card p-5 md:p-6">
          <div class="flex items-center justify-between gap-3">
            <h3 class="text-xl font-semibold text-white">Add an expense</h3>
            <span
              class="rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wider"
              :class="isSelectedMonthClosed ? 'border-red-400/40 bg-red-500/10 text-red-200' : 'theme-accent-soft'"
            >
              {{ isSelectedMonthClosed ? 'Locked' : 'Open' }}
            </span>
          </div>

          <form class="mt-4 grid gap-4" @submit.prevent="submitExpense">
            <label class="grid gap-1.5 text-sm text-zinc-200">
              Title
              <input
                v-model="expenseForm.title"
                class="ui-input"
                type="text"
                required
                minlength="2"
                maxlength="80"
                placeholder="Groceries, Uber, rent..."
                :disabled="isSelectedMonthClosed"
              >
            </label>

            <label class="grid gap-1.5 text-sm text-zinc-200">
              Amount
              <input
                v-model="expenseForm.amount"
                class="ui-input"
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                :disabled="isSelectedMonthClosed"
              >
            </label>

            <label class="grid gap-1.5 text-sm text-zinc-200">
              Category
              <UiSelect
                :model-value="expenseForm.category"
                :options="categorySelectOptions"
                :disabled="isSelectedMonthClosed"
                mobile-title="Choose Category"
                @update:model-value="updateExpenseCategory"
              />
            </label>

            <label class="grid gap-1.5 text-sm text-zinc-200">
              Date
              <UiDatePicker
                :model-value="expenseForm.date"
                :min="monthRange.start"
                :max="monthRange.end"
                :disabled="isSelectedMonthClosed"
                mobile-title="Select Date"
                @update:model-value="updateExpenseDate"
              />
            </label>

            <label class="grid gap-1.5 text-sm text-zinc-200">
              Notes
              <textarea
                v-model="expenseForm.notes"
                class="ui-input min-h-24"
                maxlength="280"
                rows="3"
                placeholder="Optional details"
                :disabled="isSelectedMonthClosed"
              ></textarea>
            </label>

            <button type="submit" class="ui-btn-primary w-full" :disabled="expenseBusy || isSelectedMonthClosed">
              {{ expenseBusy ? 'Saving...' : isSelectedMonthClosed ? 'Month is closed' : 'Add expense' }}
            </button>
          </form>
        </article>

        <article class="ui-card p-5 md:p-6">
          <h3 class="text-xl font-semibold text-white">Expenses in {{ formatMonthLabel(selectedMonth) }}</h3>

          <div v-if="!expenses.length" class="mt-4 text-sm text-zinc-500">
            No expenses recorded for this month.
          </div>

          <ul v-else class="mt-4 grid gap-3">
            <li
              v-for="expense in expenses"
              :key="expense.id"
              class="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div>
                <h4 class="text-base font-semibold text-zinc-100">{{ expense.title }}</h4>
                <p class="mt-1 text-sm text-zinc-400">{{ expense.category }} · {{ expense.date }}</p>
                <p v-if="expense.notes" class="mt-2 text-sm text-zinc-500">{{ expense.notes }}</p>
              </div>

              <div class="flex items-start justify-between gap-4 sm:flex-col sm:items-end">
                <strong class="text-lg text-white">{{ formatMoney(expense.amount) }}</strong>
                <button class="ui-btn-danger" :disabled="isSelectedMonthClosed" @click="removeExpense(expense.id)">
                  {{ isSelectedMonthClosed ? 'Locked' : 'Delete' }}
                </button>
              </div>
            </li>
          </ul>
        </article>
      </section>

      <section
        v-else-if="activeTab === 'plan-ai'"
        id="panel-plan-ai"
        role="tabpanel"
        aria-labelledby="tab-plan-ai"
        class="grid gap-4 xl:grid-cols-3"
      >
        <article class="ui-card p-5 md:p-6">
          <div class="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <h3 class="text-xl font-semibold text-white">Monthly Plan</h3>
            <span
              class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold"
              :class="hasMonthlyIncome ? 'theme-accent-soft' : 'theme-muted-pill'"
            >
              <span
                class="h-1.5 w-1.5 rounded-full"
                :class="hasMonthlyIncome ? 'theme-status-dot-active' : 'theme-status-dot-muted'"
              ></span>
              {{ hasMonthlyIncome ? 'Plan Active' : 'Not Set' }}
            </span>
          </div>

          <p class="mt-2 text-sm text-zinc-400">
            Add income and savings target to unlock daily budget guidance and richer AI planning.
          </p>

          <form class="mt-4 grid gap-4" @submit.prevent="saveMonthlyPlan">
            <label class="grid gap-1.5 text-sm text-zinc-200">
              Monthly income
              <input
                v-model="planForm.incomeAmount"
                class="ui-input"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                :disabled="isSelectedMonthClosed"
              >
              <span class="text-xs text-zinc-500">
                Required to save plan. Must be greater than 0.
              </span>
            </label>

            <label class="grid gap-1.5 text-sm text-zinc-200">
              Savings target
              <input
                v-model="planForm.savingsTarget"
                class="ui-input"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                :disabled="isSelectedMonthClosed"
              >
            </label>

            <label class="grid gap-1.5 text-sm text-zinc-200">
              Notes
              <textarea
                v-model="planForm.notes"
                class="ui-input min-h-20"
                rows="3"
                maxlength="300"
                placeholder="Optional monthly planning notes"
                :disabled="isSelectedMonthClosed"
              ></textarea>
            </label>

            <button type="submit" class="ui-btn-primary w-full" :disabled="!canSaveMonthlyPlan">
              {{ planBusy ? 'Saving plan...' : isSelectedMonthClosed ? 'Month is closed' : 'Save monthly plan' }}
            </button>
          </form>

          <div class="mt-5 grid gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-sm">
            <p v-if="selectedBudget.incomeRequired" class="theme-accent-text text-xs">
              Add monthly income to unlock daily allowance and spendable budget calculations.
            </p>
            <p class="text-zinc-300">Planned spendable: <strong class="text-white">{{ formatMoney(selectedBudget.plannedSpendable) }}</strong></p>
            <p class="text-zinc-300">Remaining budget: <strong class="text-white">{{ formatMoney(selectedBudget.remainingBudget) }}</strong></p>
            <p class="text-zinc-300">Days remaining: <strong class="text-white">{{ selectedBudget.daysRemaining }}</strong></p>
            <p class="text-zinc-300">Daily allowance: <strong class="text-white">{{ formatMoney(selectedBudget.dailyAllowance) }}</strong></p>
          </div>
        </article>

        <article class="ui-card p-5 md:p-6 xl:col-span-2">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 class="text-xl font-semibold text-white">AI Expense Coach</h3>
            <button class="ui-btn-secondary" :disabled="aiBusy || monthBusy || !aiQuestion.trim()" @click="askAiAdvice">
              {{ aiBusy ? 'Analyzing...' : 'Ask AI' }}
            </button>
          </div>

          <p class="mt-3 text-sm text-zinc-400">Ask only expense tracking questions for {{ formatMonthLabel(selectedMonth) }}.</p>

          <label class="mt-3 grid gap-1.5 text-sm text-zinc-200">
            Your question
            <textarea
              v-model="aiQuestion"
              class="ui-input min-h-24"
              placeholder="Example: How much can I spend daily this month if I want to save 300 from my income?"
              maxlength="500"
            ></textarea>
          </label>

          <div class="mt-3 flex flex-wrap gap-2">
            <button
              v-for="question in quickQuestions"
              :key="question"
              class="theme-accent-hover rounded-full border border-white/15 bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-300 transition"
              @click="askQuickQuestion(question)"
            >
              {{ question }}
            </button>
          </div>

          <p class="mt-3 text-sm text-zinc-400">
            Source:
            <strong class="text-zinc-200">{{ aiResponse?.source === 'openai' ? 'OpenAI live analysis' : 'Local fallback guidance' }}</strong>
          </p>

          <p v-if="monthDetail?.summaryText" class="theme-accent-panel mt-3 rounded-xl px-3 py-2 text-sm">
            {{ monthDetail.summaryText }}
          </p>

          <div v-if="aiResponse" class="theme-accent-panel mt-4 rounded-xl p-3">
            <p class="text-sm text-zinc-100">{{ aiResponse.answer }}</p>
            <ul v-if="aiResponse.actions.length" class="mt-3 grid gap-2">
              <li
                v-for="item in aiResponse.actions"
                :key="item"
                class="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-sm text-zinc-200"
              >
                {{ item }}
              </li>
            </ul>
          </div>
          <p v-else class="mt-4 text-sm text-zinc-500">
            AI answers appear here after you submit a relevant budget or expense question.
          </p>

          <h4 class="mt-6 text-lg font-semibold text-zinc-100">Category snapshot</h4>
          <ul v-if="categorySnapshot.length" class="mt-3 grid gap-2">
            <li
              v-for="[category, total] in categorySnapshot"
              :key="category"
              class="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm"
            >
              <span class="text-zinc-300">{{ category }}</span>
              <strong class="text-white">{{ formatMoney(total) }}</strong>
            </li>
          </ul>
          <p v-else class="mt-3 text-sm text-zinc-500">No category data yet.</p>
        </article>
      </section>

      <section
        v-else
        id="panel-archive"
        role="tabpanel"
        aria-labelledby="tab-archive"
        class="grid gap-4"
      >
        <section class="ui-card p-5 md:p-6">
          <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 class="text-xl font-semibold text-white">Close this month</h3>
              <p class="mt-1 text-sm text-zinc-400">
                Closing locks {{ formatMonthLabel(selectedMonth) }} permanently. You will not be able to edit expenses after closing.
              </p>
            </div>
            <button
              class="ui-btn-primary"
              :disabled="isSelectedMonthClosed || closeMonthBusy"
              @click="closeSelectedMonth"
            >
              {{ closeMonthBusy ? 'Closing...' : isSelectedMonthClosed ? 'Month closed' : 'Close month' }}
            </button>
          </div>
        </section>

        <section class="ui-card p-5 md:p-6">
          <div class="flex flex-col gap-1">
            <h3 class="text-xl font-semibold text-white">Monthly archive</h3>
            <p class="text-sm text-zinc-500">Closed months are permanently locked. Open months stay editable.</p>
          </div>

          <ul v-if="monthSummaries.length" class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <li
              v-for="summary in monthSummaries"
              :key="summary.month"
              class="rounded-xl border p-4 transition"
              :class="summary.month === selectedMonth
                ? 'theme-accent-panel'
                : 'border-white/10 bg-white/[0.03] theme-accent-border-hover'"
            >
              <button class="grid w-full gap-2 text-left" @click="selectMonth(summary.month)">
                <div class="flex items-center justify-between gap-2">
                  <h4 class="text-base font-semibold text-zinc-100">{{ formatMonthLabel(summary.month) }}</h4>
                  <span
                    class="rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                    :class="summary.isClosed ? 'border-red-400/35 text-red-200' : 'theme-accent-outline'"
                  >
                    {{ summary.isClosed ? 'Closed' : 'Open' }}
                  </span>
                </div>
                <p class="text-sm text-zinc-300">{{ formatMoney(summary.totalAmount) }} · {{ summary.transactionCount }} tx</p>
                <p class="text-xs text-zinc-500">Top: {{ summary.topCategory }}</p>
              </button>
            </li>
          </ul>
          <p v-else class="mt-4 text-sm text-zinc-500">No monthly history yet. Add your first expenses to begin tracking.</p>
        </section>
      </section>
    </template>

    <section v-else class="ui-card p-5 text-sm text-zinc-300">
      Redirecting to sign in...
    </section>
  </main>
</template>
