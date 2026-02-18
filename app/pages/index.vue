<script setup lang="ts">
import { EXPENSE_CATEGORIES, type ExpenseRecord, type UserPublic } from '~~/shared/types'

useHead({
  title: 'LedgerLift | AI Expense Tracker',
  meta: [
    {
      name: 'description',
      content: 'Track your expenses, manage authentication, and get AI suggestions for better spending habits.'
    }
  ]
})

type FeedbackKind = 'success' | 'error' | 'info'

const categories = [...EXPENSE_CATEGORIES]
const today = new Date().toISOString().slice(0, 10)

const loading = ref(true)
const authBusy = ref(false)
const expenseBusy = ref(false)
const suggestionBusy = ref(false)

const user = ref<UserPublic | null>(null)
const expenses = ref<ExpenseRecord[]>([])
const suggestions = ref<string[]>([])
const suggestionSource = ref<'openai' | 'fallback' | null>(null)

const authMode = ref<'login' | 'register'>('login')
const authForm = reactive({
  email: '',
  password: ''
})

const expenseForm = reactive({
  title: '',
  amount: '',
  category: categories[0],
  date: today,
  notes: ''
})

const feedback = ref<{ kind: FeedbackKind, message: string } | null>(null)

const totalSpend = computed(() => {
  return expenses.value.reduce((sum, expense) => sum + expense.amount, 0)
})

const currentMonthTotal = computed(() => {
  const monthPrefix = today.slice(0, 7)

  return expenses.value
    .filter((expense) => expense.date.startsWith(monthPrefix))
    .reduce((sum, expense) => sum + expense.amount, 0)
})

const topCategory = computed(() => {
  if (!expenses.value.length) {
    return 'No expenses yet'
  }

  const grouped = new Map<string, number>()
  for (const expense of expenses.value) {
    grouped.set(expense.category, (grouped.get(expense.category) || 0) + expense.amount)
  }

  const [name] = [...grouped.entries()].sort((left, right) => right[1] - left[1])[0]
  return name
})

const categorySnapshot = computed(() => {
  const grouped = new Map<string, number>()

  for (const expense of expenses.value) {
    grouped.set(expense.category, (grouped.get(expense.category) || 0) + expense.amount)
  }

  return [...grouped.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
})

function resetExpenseForm() {
  expenseForm.title = ''
  expenseForm.amount = ''
  expenseForm.category = categories[0]
  expenseForm.date = today
  expenseForm.notes = ''
}

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

async function refreshSession() {
  const response = await $fetch<{ user: UserPublic | null }>('/api/auth/me')
  user.value = response.user
}

async function loadExpenses() {
  if (!user.value) {
    expenses.value = []
    return
  }

  const response = await $fetch<{ expenses: ExpenseRecord[] }>('/api/expenses')
  expenses.value = response.expenses
}

async function loadSuggestions() {
  if (!user.value) {
    suggestions.value = []
    suggestionSource.value = null
    return
  }

  suggestionBusy.value = true
  try {
    const response = await $fetch<{
      source: 'openai' | 'fallback'
      suggestions: string[]
    }>('/api/ai/suggestions')

    suggestionSource.value = response.source
    suggestions.value = response.suggestions
  }
  catch (error) {
    setFeedback('error', getErrorMessage(error))
  }
  finally {
    suggestionBusy.value = false
  }
}

async function submitAuth() {
  authBusy.value = true

  try {
    const endpoint = authMode.value === 'login'
      ? '/api/auth/login'
      : '/api/auth/register'

    const response = await $fetch<{ user: UserPublic }>(endpoint, {
      method: 'POST',
      body: {
        email: authForm.email,
        password: authForm.password
      }
    })

    user.value = response.user
    authForm.password = ''

    await loadExpenses()
    await loadSuggestions()
    setFeedback('success', `Welcome ${response.user.email}. Your dashboard is ready.`)
  }
  catch (error) {
    setFeedback('error', getErrorMessage(error))
  }
  finally {
    authBusy.value = false
  }
}

async function submitExpense() {
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

    await loadExpenses()
    await loadSuggestions()
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
  try {
    await $fetch(`/api/expenses/${expenseId}`, {
      method: 'DELETE'
    })

    await loadExpenses()
    await loadSuggestions()
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
  expenses.value = []
  suggestions.value = []
  suggestionSource.value = null
  authForm.password = ''
  setFeedback('info', 'You are logged out.')
}

await refreshSession()
if (user.value) {
  await loadExpenses()
  await loadSuggestions()
}
loading.value = false
</script>

<template>
  <main class="page-wrap">
    <section class="hero">
      <p class="chip">Expense intelligence for teams and individuals</p>
      <h1>LedgerLift</h1>
      <p class="hero-copy">
        Track every purchase, control your monthly spend, and get practical AI suggestions tailored to your actual transactions.
      </p>
    </section>

    <section v-if="feedback" class="feedback" :data-kind="feedback.kind">
      {{ feedback.message }}
    </section>

    <section v-if="loading" class="panel">
      <p>Loading your workspace...</p>
    </section>

    <template v-else-if="!user">
      <section class="panel auth-panel">
        <div>
          <h2>{{ authMode === 'login' ? 'Sign in' : 'Create account' }}</h2>
          <p class="muted">
            {{ authMode === 'login' ? 'Welcome back. Continue where you left off.' : 'Create your account and start tracking today.' }}
          </p>
        </div>

        <form class="auth-form" @submit.prevent="submitAuth">
          <label>
            Email
            <input
              v-model="authForm.email"
              type="email"
              required
              autocomplete="email"
              placeholder="you@example.com"
            >
          </label>

          <label>
            Password
            <input
              v-model="authForm.password"
              type="password"
              required
              autocomplete="current-password"
              placeholder="Minimum 8 characters"
            >
          </label>

          <button type="submit" :disabled="authBusy">
            {{ authBusy ? 'Please wait...' : authMode === 'login' ? 'Sign in' : 'Create account' }}
          </button>
        </form>

        <button class="link-action" @click="authMode = authMode === 'login' ? 'register' : 'login'">
          {{ authMode === 'login' ? 'Need an account? Register here.' : 'Already have an account? Log in.' }}
        </button>
      </section>
    </template>

    <template v-else>
      <section class="panel top-row">
        <div>
          <h2>{{ user.email }}</h2>
          <p class="muted">Use your dashboard to add expenses and check smart suggestions.</p>
        </div>
        <button class="secondary" @click="logout">Log out</button>
      </section>

      <section class="stats-grid">
        <article class="panel stat-card">
          <h3>Total spend</h3>
          <p class="amount">${{ totalSpend.toFixed(2) }}</p>
        </article>
        <article class="panel stat-card">
          <h3>This month</h3>
          <p class="amount">${{ currentMonthTotal.toFixed(2) }}</p>
        </article>
        <article class="panel stat-card">
          <h3>Top category</h3>
          <p class="amount small">{{ topCategory }}</p>
        </article>
      </section>

      <section class="workspace-grid">
        <article class="panel form-panel">
          <h3>Add an expense</h3>
          <form class="expense-form" @submit.prevent="submitExpense">
            <label>
              Title
              <input v-model="expenseForm.title" type="text" required minlength="2" maxlength="80" placeholder="Groceries, Uber, rent...">
            </label>

            <label>
              Amount
              <input v-model="expenseForm.amount" type="number" step="0.01" min="0.01" required placeholder="0.00">
            </label>

            <label>
              Category
              <select v-model="expenseForm.category">
                <option v-for="category in categories" :key="category" :value="category">
                  {{ category }}
                </option>
              </select>
            </label>

            <label>
              Date
              <input v-model="expenseForm.date" type="date" required>
            </label>

            <label>
              Notes
              <textarea v-model="expenseForm.notes" maxlength="280" rows="3" placeholder="Optional details"></textarea>
            </label>

            <button type="submit" :disabled="expenseBusy">
              {{ expenseBusy ? 'Saving...' : 'Add expense' }}
            </button>
          </form>
        </article>

        <article class="panel suggestions-panel">
          <div class="title-row">
            <h3>AI Suggestions</h3>
            <button class="secondary" :disabled="suggestionBusy" @click="loadSuggestions">
              {{ suggestionBusy ? 'Refreshing...' : 'Refresh' }}
            </button>
          </div>

          <p class="muted">
            Source:
            <strong>{{ suggestionSource === 'openai' ? 'OpenAI live analysis' : 'Rule-based fallback' }}</strong>
          </p>

          <ul v-if="suggestions.length" class="suggestion-list">
            <li v-for="item in suggestions" :key="item">{{ item }}</li>
          </ul>
          <p v-else class="muted">Suggestions will appear once you add expenses.</p>

          <h4>Category snapshot</h4>
          <ul v-if="categorySnapshot.length" class="snapshot-list">
            <li v-for="[category, total] in categorySnapshot" :key="category">
              <span>{{ category }}</span>
              <strong>${{ total.toFixed(2) }}</strong>
            </li>
          </ul>
          <p v-else class="muted">No category data yet.</p>
        </article>
      </section>

      <section class="panel expenses-panel">
        <h3>Recent expenses</h3>

        <div v-if="!expenses.length" class="muted">
          No expenses yet. Add your first one using the form above.
        </div>

        <ul v-else class="expense-list">
          <li v-for="expense in expenses" :key="expense.id" class="expense-item">
            <div>
              <h4>{{ expense.title }}</h4>
              <p class="muted">{{ expense.category }} · {{ expense.date }}</p>
              <p v-if="expense.notes" class="note">{{ expense.notes }}</p>
            </div>

            <div class="expense-actions">
              <strong>${{ expense.amount.toFixed(2) }}</strong>
              <button class="danger" @click="removeExpense(expense.id)">Delete</button>
            </div>
          </li>
        </ul>
      </section>
    </template>
  </main>
</template>

<style scoped>
.page-wrap {
  max-width: 1100px;
  margin: 0 auto;
  padding: 2.2rem 1rem 4rem;
  display: grid;
  gap: 1rem;
}

.hero {
  display: grid;
  gap: 0.5rem;
  animation: rise 0.6s ease;
}

.hero h1 {
  font-size: clamp(2rem, 5vw, 3rem);
  letter-spacing: -0.03em;
}

.hero-copy {
  color: var(--text-muted);
  max-width: 68ch;
}

.chip {
  width: fit-content;
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #0f6a58;
  background: rgba(214, 239, 232, 0.8);
  border: 1px solid rgba(15, 106, 88, 0.18);
  border-radius: 999px;
  padding: 0.3rem 0.7rem;
}

.panel {
  background: var(--surface);
  backdrop-filter: blur(10px);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: var(--shadow);
  padding: 1rem;
}

.top-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
}

.auth-panel {
  max-width: 560px;
  display: grid;
  gap: 1rem;
}

.auth-form,
.expense-form {
  display: grid;
  gap: 0.8rem;
}

label {
  display: grid;
  gap: 0.35rem;
  font-weight: 600;
  color: #2f343d;
}

input,
select,
textarea {
  width: 100%;
  border-radius: 10px;
  border: 1px solid rgba(31, 35, 42, 0.18);
  background: var(--surface-strong);
  padding: 0.62rem 0.7rem;
  color: var(--text-main);
}

input:focus,
select:focus,
textarea:focus {
  outline: 2px solid rgba(13, 126, 105, 0.32);
  border-color: transparent;
}

button {
  border: 0;
  border-radius: 10px;
  background: linear-gradient(135deg, #0d7e69, #0a6a58);
  color: #fff;
  font-weight: 600;
  padding: 0.65rem 0.95rem;
  cursor: pointer;
  transition: transform 0.16s ease, filter 0.16s ease;
}

button:hover:enabled {
  transform: translateY(-1px);
  filter: brightness(1.06);
}

button:disabled {
  opacity: 0.72;
  cursor: not-allowed;
}

button.secondary {
  background: rgba(255, 255, 255, 0.72);
  color: #25453f;
  border: 1px solid rgba(37, 69, 63, 0.22);
}

button.danger {
  background: rgba(177, 66, 66, 0.14);
  color: var(--danger);
  border: 1px solid rgba(177, 66, 66, 0.26);
  padding-inline: 0.7rem;
}

.link-action {
  width: fit-content;
  padding: 0;
  border: 0;
  background: transparent;
  color: #145848;
  text-decoration: underline;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.stat-card {
  display: grid;
  gap: 0.45rem;
}

.amount {
  font-size: clamp(1.55rem, 3.8vw, 2.2rem);
  line-height: 1.12;
  letter-spacing: -0.02em;
}

.amount.small {
  font-size: 1.35rem;
}

.workspace-grid {
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  gap: 1rem;
}

.title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.7rem;
}

.suggestions-panel {
  display: grid;
  gap: 0.9rem;
}

.suggestion-list,
.snapshot-list,
.expense-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.6rem;
}

.suggestion-list li {
  padding: 0.65rem 0.75rem;
  border-radius: 10px;
  background: rgba(214, 239, 232, 0.62);
  border: 1px solid rgba(13, 126, 105, 0.2);
}

.snapshot-list li {
  display: flex;
  justify-content: space-between;
  gap: 0.8rem;
  padding: 0.52rem 0.65rem;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.68);
  border: 1px solid rgba(31, 35, 42, 0.12);
}

.expenses-panel {
  display: grid;
  gap: 0.75rem;
}

.expense-item {
  display: flex;
  justify-content: space-between;
  gap: 0.9rem;
  padding: 0.8rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.73);
  border: 1px solid rgba(31, 35, 42, 0.1);
}

.expense-item h4 {
  margin-bottom: 0.2rem;
}

.expense-actions {
  display: grid;
  justify-items: end;
  align-content: start;
  gap: 0.4rem;
}

.feedback {
  border-radius: 10px;
  padding: 0.75rem 0.85rem;
  border: 1px solid transparent;
  animation: rise 0.32s ease;
}

.feedback[data-kind='success'] {
  background: rgba(214, 239, 232, 0.78);
  border-color: rgba(13, 126, 105, 0.2);
  color: #0a5a4a;
}

.feedback[data-kind='error'] {
  background: rgba(255, 221, 221, 0.72);
  border-color: rgba(177, 66, 66, 0.24);
  color: #8f3232;
}

.feedback[data-kind='info'] {
  background: rgba(230, 237, 246, 0.82);
  border-color: rgba(44, 77, 125, 0.23);
  color: #20436f;
}

.note,
.muted {
  color: var(--text-muted);
}

@media (max-width: 920px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .workspace-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .page-wrap {
    padding-top: 1.3rem;
  }

  .top-row,
  .expense-item {
    flex-direction: column;
  }

  .expense-actions {
    justify-items: start;
  }
}

@keyframes rise {
  from {
    transform: translateY(6px);
    opacity: 0;
  }

  to {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>
