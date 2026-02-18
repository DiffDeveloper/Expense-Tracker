// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  srcDir: 'app/',
  serverDir: 'server/',
  css: ['~/assets/css/main.css'],
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  runtimeConfig: {
    jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini'
  }
})
