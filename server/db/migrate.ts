import 'dotenv/config'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { migrate } from 'drizzle-orm/neon-http/migrator'

async function run() {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set. Cannot run database migrations.')
  }

  const sql = neon(databaseUrl)
  const db = drizzle({ client: sql })

  await migrate(db, { migrationsFolder: 'drizzle' })
}

run()
  .then(() => {
    process.stdout.write('Migrations completed successfully.\n')
  })
  .catch((error) => {
    process.stderr.write(`Migration failed: ${String(error)}\n`)
    process.exit(1)
  })
