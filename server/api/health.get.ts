import { sql } from 'drizzle-orm'
import { createError } from 'h3'
import { db } from '../db/client'

export default defineEventHandler(async () => {
  try {
    await db.execute(sql`select 1`)
  }
  catch {
    throw createError({
      statusCode: 503,
      statusMessage: 'Database health check failed.'
    })
  }

  return {
    ok: true,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  }
})
