<script setup lang="ts">
const supportedThemes = new Set(['black-orange', 'dark-white', 'green-white'])

onMounted(() => {
  const storedTheme = localStorage.getItem('diff-theme')

  if (storedTheme && supportedThemes.has(storedTheme)) {
    document.documentElement.setAttribute('data-theme', storedTheme)
    return
  }

  document.documentElement.setAttribute('data-theme', 'black-orange')
})
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </div>
</template>
