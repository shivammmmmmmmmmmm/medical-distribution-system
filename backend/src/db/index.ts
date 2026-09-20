import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise'

type DbModule = {
  initDatabase: () => Promise<void>
  query: <T>(sql: string, params?: unknown[]) => Promise<T[]>
  queryOne: <T>(sql: string, params?: unknown[]) => Promise<T | null>
  run: (sql: string, params?: unknown[]) => Promise<ResultSetHeader | { changes: number; lastInsertRowid: number | bigint }>
  getDriverName?: () => 'mysql' | 'sqlite'
}

let active: DbModule
let driverLabel: 'mysql' | 'sqlite' = 'mysql'

export function getActiveDriver() {
  return driverLabel
}

export async function initDatabase(): Promise<void> {
  const requested = (process.env.DB_DRIVER || 'mysql').toLowerCase()

  if (process.env.NODE_ENV === 'production' && requested === 'mysql') {
    const required = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_NAME']
    const missing = required.filter((name) => !process.env[name]?.trim())
    if (missing.length > 0) {
      throw new Error(`Missing production database configuration: ${missing.join(', ')}`)
    }
  }

  if (requested === 'sqlite') {
    active = await import('./sqlite.js')
    driverLabel = 'sqlite'
    await active.initDatabase()
    const { ensureExtendedSchema } = await import('./extended-schema.js')
    await ensureExtendedSchema()
    return
  }

  try {
    const mysqlDb = await import('./mysql.js')
    await mysqlDb.initDatabase()
    active = mysqlDb
    driverLabel = 'mysql'
  } catch (err: unknown) {
    const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: string }).code) : ''
    const retryable = ['ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'EHOSTUNREACH'].includes(code)

    if (!retryable && process.env.DB_FALLBACK_SQLITE !== '1') {
      throw err
    }

    console.warn('\n⚠️  MySQL is not responding (XAMPP may need a restart).')
    console.warn(`   Error: ${code || (err instanceof Error ? err.message : 'connection failed')}`)
    console.warn('   Using SQLite instead → backend/data/medical.db')
    console.warn('   Fix MySQL: XAMPP → Stop MySQL → Start MySQL, set DB_HOST=127.0.0.1, DB_DRIVER=mysql\n')

    active = await import('./sqlite.js')
    driverLabel = 'sqlite'
    await active.initDatabase()
  }

  const { ensureExtendedSchema } = await import('./extended-schema.js')
  await ensureExtendedSchema()
}

export async function query<T = RowDataPacket>(sql: string, params: unknown[] = []): Promise<T[]> {
  return active.query<T>(sql, params)
}

export async function queryOne<T = RowDataPacket>(sql: string, params: unknown[] = []): Promise<T | null> {
  return active.queryOne<T>(sql, params)
}

export async function run(sql: string, params: unknown[] = []): Promise<ResultSetHeader> {
  return active.run(sql, params) as Promise<ResultSetHeader>
}

export function getPool(): Pool | null {
  return null
}
