<script setup lang="ts">
definePageMeta({
  middleware: 'guest'
})

useHead({
  title: 'Diff Expense Tracker | Sign In',
  meta: [
    {
      name: 'description',
      content: 'Create an account to track monthly expenses, set income plans, and review locked history.'
    }
  ]
})

type AuthMode = 'login' | 'register'
type FeedbackKind = 'success' | 'error' | 'info'

const authMode = ref<AuthMode>('login')
const authBusy = ref(false)

const authForm = reactive({
  email: '',
  username: '',
  password: '',
  confirmPassword: '',
  rememberMe: true
})

const feedback = ref<{ kind: FeedbackKind, message: string } | null>(null)

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

function switchAuthMode(nextMode: AuthMode) {
  authMode.value = nextMode
  authForm.password = ''
  authForm.confirmPassword = ''
  feedback.value = null
}

async function submitAuth() {
  authBusy.value = true

  try {
    if (authMode.value === 'register' && authForm.password !== authForm.confirmPassword) {
      setFeedback('error', 'Password and confirm password must match.')
      return
    }

    const endpoint = authMode.value === 'login'
      ? '/api/auth/login'
      : '/api/auth/register'

    await $fetch(endpoint, {
      method: 'POST',
      body: authMode.value === 'login'
        ? {
            email: authForm.email,
            password: authForm.password,
            rememberMe: authForm.rememberMe
          }
        : {
            email: authForm.email,
            username: authForm.username,
            password: authForm.password,
            confirmPassword: authForm.confirmPassword
          }
    })

    await navigateTo('/dashboard')
  }
  catch (error) {
    setFeedback('error', getErrorMessage(error))
  }
  finally {
    authBusy.value = false
  }
}
</script>

<template>
  <main class="mx-auto grid min-h-screen w-full max-w-6xl gap-6 px-4 py-8 md:grid-cols-[1.1fr_1fr] md:items-center md:px-6">
    <section class="ui-card-soft p-6 md:p-7">
      <p class="ui-chip">Get Started</p>
      <h1 class="mt-4 text-3xl leading-tight text-white md:text-4xl">
        Sign in to <span class="theme-accent-text">Diff Expense Tracker</span>
      </h1>
      <p class="mt-3 text-sm text-zinc-300 md:text-base">
        Build better spending habits with monthly plans, AI coaching, and locked historical tracking you can trust.
      </p>

      <div class="mt-6 grid gap-3 text-sm text-zinc-200">
        <div class="ui-card p-3">
          <p class="font-semibold text-white">1. Track daily expenses</p>
          <p class="mt-1 text-zinc-400">Log transactions quickly and keep all categories organized.</p>
        </div>
        <div class="ui-card p-3">
          <p class="font-semibold text-white">2. Plan monthly budget</p>
          <p class="mt-1 text-zinc-400">Set income and savings targets to get daily allowance guidance.</p>
        </div>
        <div class="ui-card p-3">
          <p class="font-semibold text-white">3. Lock and review history</p>
          <p class="mt-1 text-zinc-400">Close months to preserve clean records and compare trends.</p>
        </div>
      </div>

      <NuxtLink class="theme-accent-link mt-6 inline-block text-sm underline underline-offset-4" to="/">
        Back to project overview
      </NuxtLink>
    </section>

    <section class="ui-card p-5 md:p-6">
      <div class="mb-5 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-1">
        <button
          type="button"
          class="rounded-lg px-3 py-2 text-sm font-semibold transition"
          :class="authMode === 'login' ? 'theme-accent-soft' : 'text-zinc-300 hover:bg-white/[0.04]'"
          @click="switchAuthMode('login')"
        >
          Sign in
        </button>
        <button
          type="button"
          class="rounded-lg px-3 py-2 text-sm font-semibold transition"
          :class="authMode === 'register' ? 'theme-accent-soft' : 'text-zinc-300 hover:bg-white/[0.04]'"
          @click="switchAuthMode('register')"
        >
          Create account
        </button>
      </div>

      <section
        v-if="feedback"
        class="mb-4 rounded-xl px-3 py-2 text-sm"
        :class="{
          'ui-feedback-success': feedback.kind === 'success',
          'ui-feedback-error': feedback.kind === 'error',
          'ui-feedback-info': feedback.kind === 'info'
        }"
      >
        {{ feedback.message }}
      </section>

      <form class="grid gap-4" @submit.prevent="submitAuth">
        <label class="grid gap-1.5 text-sm text-zinc-200">
          Email
          <input
            v-model="authForm.email"
            class="ui-input"
            type="email"
            required
            autocomplete="email"
            placeholder="you@example.com"
          >
        </label>

        <label v-if="authMode === 'register'" class="grid gap-1.5 text-sm text-zinc-200">
          Username
          <input
            v-model="authForm.username"
            class="ui-input"
            type="text"
            required
            minlength="3"
            maxlength="24"
            autocomplete="username"
            placeholder="e.g. diff_saver"
          >
        </label>

        <label class="grid gap-1.5 text-sm text-zinc-200">
          Password
          <input
            v-model="authForm.password"
            class="ui-input"
            type="password"
            required
            autocomplete="current-password"
            placeholder="Minimum 8 characters"
          >
        </label>

        <label v-if="authMode === 'register'" class="grid gap-1.5 text-sm text-zinc-200">
          Confirm password
          <input
            v-model="authForm.confirmPassword"
            class="ui-input"
            type="password"
            required
            autocomplete="new-password"
            placeholder="Repeat your password"
          >
        </label>

        <label
          v-if="authMode === 'login'"
          class="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-300"
        >
          <input
            v-model="authForm.rememberMe"
            type="checkbox"
            class="theme-checkbox h-4 w-4 rounded border-white/30 bg-zinc-900"
          >
          Remember me
        </label>

        <button type="submit" class="ui-btn-primary w-full" :disabled="authBusy">
          {{ authBusy ? 'Please wait...' : authMode === 'login' ? 'Sign in now' : 'Create my account' }}
        </button>
      </form>
    </section>
  </main>
</template>
