export default defineNitroPlugin(() => {
  const isProduction = process.env.NODE_ENV === 'production'
  const runtimeConfig = useRuntimeConfig()
  const missingVariables: string[] = []

  if (!runtimeConfig.jwtSecret) {
    missingVariables.push('JWT_SECRET')
  }

  if (!process.env.DATABASE_URL) {
    missingVariables.push('DATABASE_URL')
  }

  if (missingVariables.length > 0) {
    const message = `Missing required environment variables: ${missingVariables.join(', ')}`

    if (isProduction) {
      throw new Error(message)
    }

    console.warn(`[env] ${message}`)
  }

  if (runtimeConfig.jwtSecret && runtimeConfig.jwtSecret.length < 32) {
    const message = 'JWT_SECRET should be at least 32 characters long.'

    if (isProduction) {
      throw new Error(message)
    }

    console.warn(`[env] ${message}`)
  }
})
