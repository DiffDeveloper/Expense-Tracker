export default defineNuxtRouteMiddleware(async () => {
  const headers = import.meta.server
    ? useRequestHeaders(['cookie'])
    : undefined

  try {
    const response = await $fetch<{ user: { id: string } | null }>('/api/auth/me', { headers })

    if (!response.user) {
      return navigateTo('/auth')
    }
  }
  catch {
    return navigateTo('/auth')
  }
})
