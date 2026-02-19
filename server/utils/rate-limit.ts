import { createError, getRequestIP, setResponseHeader, type H3Event } from 'h3'

interface RateLimitBucket {
  count: number
  resetAt: number
}

interface RateLimitOptions {
  max: number
  windowMs: number
  message: string
}

const buckets = new Map<string, RateLimitBucket>()

function getClientIdentifier(event: H3Event) {
  return getRequestIP(event, { xForwardedFor: true }) || 'unknown'
}

export function enforceRateLimit(event: H3Event, scope: string, options: RateLimitOptions) {
  const now = Date.now()
  const identifier = getClientIdentifier(event)
  const key = `${scope}:${identifier}`
  const existing = buckets.get(key)

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + options.windowMs
    })
    return
  }

  if (existing.count >= options.max) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
    setResponseHeader(event, 'Retry-After', retryAfterSeconds)

    throw createError({
      statusCode: 429,
      statusMessage: options.message
    })
  }

  existing.count += 1
}
