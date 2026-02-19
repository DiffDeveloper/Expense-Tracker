import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set. Add it to your environment variables.')
  }

  return databaseUrl
}

const sql = neon(getDatabaseUrl())

export const db = drizzle({
  client: sql,
  schema
})
