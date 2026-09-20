import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { hashPassword } from '../utils/auth.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'medical.db')

let db: Database.Database

export function getDriverName() {
  return 'sqlite' as const
}

export async function initDatabase(): Promise<void> {
  const dataDir = path.dirname(DB_PATH)
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('ADMIN','SALES_PERSON','USER')),
      customer_type TEXT CHECK(customer_type IN ('DISTRIBUTOR','HOSPITAL','CLINIC','PHARMACY')),
      phone TEXT,
      organization_name TEXT,
      address TEXT,
      territory TEXT,
      assigned_sp_id TEXT REFERENCES users(id),
      commission_pct REAL DEFAULT 0,
      credit_limit REAL DEFAULT 0,
      credit_used REAL DEFAULT 0,
      is_blocked INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_login TEXT
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      company_name TEXT,
      category TEXT,
      description TEXT,
      ingredients TEXT,
      strength TEXT,
      dosage_form TEXT,
      mrp REAL DEFAULT 0,
      selling_price REAL DEFAULT 0,
      discount_pct REAL DEFAULT 0,
      sku TEXT UNIQUE NOT NULL,
      manufacturer TEXT,
      quantity INTEGER NOT NULL DEFAULT 0,
      reorder_level INTEGER NOT NULL DEFAULT 0,
      image_url TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_number TEXT UNIQUE NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id),
      sp_id TEXT REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK(status IN ('PENDING','APPROVED','DISPATCHED','DELIVERED','COMPLETED','CANCELLED')),
      payment_method TEXT DEFAULT 'CREDIT'
        CHECK(payment_method IN ('CREDIT','UPI','BANK_TRANSFER','CASH')),
      payment_status TEXT DEFAULT 'PENDING'
        CHECK(payment_status IN ('PENDING','PARTIAL','PAID')),
      subtotal REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      total_amount REAL DEFAULT 0,
      paid_amount REAL DEFAULT 0,
      notes TEXT,
      shipping_address TEXT,
      delivered_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL REFERENCES products(id),
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      discount_pct REAL DEFAULT 0,
      total_price REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ledger (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      type TEXT NOT NULL CHECK(type IN ('DEBIT','CREDIT')),
      amount REAL NOT NULL,
      balance_after REAL NOT NULL,
      description TEXT NOT NULL,
      reference_id TEXT,
      reference_type TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS commissions (
      id TEXT PRIMARY KEY,
      sp_id TEXT NOT NULL REFERENCES users(id),
      order_id TEXT NOT NULL REFERENCES orders(id),
      order_amount REAL NOT NULL,
      commission_pct REAL NOT NULL,
      commission_amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK(status IN ('PENDING','APPROVED','PAID')),
      paid_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS product_pricing (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('ADMIN','SALES_PERSON','USER')),
      price REAL NOT NULL,
      min_quantity INTEGER NOT NULL DEFAULT 1,
      max_quantity INTEGER,
      effective_from TEXT NOT NULL DEFAULT (datetime('now')),
      effective_to TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  migrateUsersTable()
  migrateProductsTable()

  await seedIfEmpty()
  console.log(`✅ SQLite database ready: ${DB_PATH}`)
}

function migrateProductsTable(): void {
  const addCol = (sql: string) => {
    try {
      db.exec(sql)
    } catch {
      /* column exists */
    }
  }
  addCol(`ALTER TABLE products ADD COLUMN company_name TEXT`)
  addCol(`ALTER TABLE products ADD COLUMN ingredients TEXT`)
  addCol(`ALTER TABLE products ADD COLUMN strength TEXT`)
  addCol(`ALTER TABLE products ADD COLUMN dosage_form TEXT`)
  addCol(`ALTER TABLE products ADD COLUMN mrp REAL DEFAULT 0`)
  addCol(`ALTER TABLE products ADD COLUMN selling_price REAL DEFAULT 0`)
  addCol(`ALTER TABLE products ADD COLUMN discount_pct REAL DEFAULT 0`)
  addCol(`ALTER TABLE products ADD COLUMN image_url TEXT`)

  // Backfill prices for legacy rows (manufacturer column was used as company in old seed)
  try {
    db.exec(`
      UPDATE products SET
        company_name = COALESCE(company_name, manufacturer),
        mrp = CASE WHEN mrp IS NULL OR mrp = 0 THEN 10 ELSE mrp END,
        selling_price = CASE WHEN selling_price IS NULL OR selling_price = 0 THEN 8 ELSE selling_price END,
        discount_pct = COALESCE(discount_pct, 0)
      WHERE mrp IS NULL OR mrp = 0 OR selling_price IS NULL OR selling_price = 0
    `)
  } catch {
    /* ignore */
  }
}

function migrateUsersTable(): void {
  const addCol = (sql: string) => {
    try {
      db.exec(sql)
    } catch {
      /* column exists */
    }
  }
  addCol(`ALTER TABLE users ADD COLUMN customer_type TEXT`)
  addCol(`ALTER TABLE users ADD COLUMN phone TEXT`)
  addCol(`ALTER TABLE users ADD COLUMN address TEXT`)
  addCol(`ALTER TABLE users ADD COLUMN territory TEXT`)
  addCol(`ALTER TABLE users ADD COLUMN assigned_sp_id TEXT`)
  addCol(`ALTER TABLE users ADD COLUMN commission_pct REAL DEFAULT 0`)
  addCol(`ALTER TABLE users ADD COLUMN credit_limit REAL DEFAULT 50000`)
  addCol(`ALTER TABLE users ADD COLUMN credit_used REAL DEFAULT 0`)
  addCol(`ALTER TABLE users ADD COLUMN is_blocked INTEGER NOT NULL DEFAULT 0`)
}

async function seedIfEmpty(): Promise<void> {
  const now = new Date().toISOString()
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim()
  const adminPassword = process.env.SEED_ADMIN_PASSWORD
  if (adminEmail && adminPassword) {
    const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail)
    if (!adminExists) {
      const adminHash = await hashPassword(adminPassword)
      db.prepare(
        `INSERT INTO users (id,email,password_hash,name,role,organization_name,is_active,created_at,updated_at)
         VALUES (?,?,?,?,?,?,1,?,?)`
      ).run('admin-001', adminEmail, adminHash, 'System Admin', 'ADMIN', 'Medical Distribution Co.', now, now)
    }
  }

  const ins = db.prepare(
    `INSERT INTO products (id,name,company_name,category,sku,mrp,selling_price,discount_pct,manufacturer,quantity,reorder_level,is_active,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,1,?,?)`
  )

  const products = [
    ['prod-001', 'Paracetamol 500mg', 'Sun Pharma', 'Analgesics', 'PARA-500-001', 12, 10, 16.67, 10000, 1000],
    ['prod-002', 'Amoxicillin 250mg', 'Cipla', 'Antibiotics', 'AMOX-250-001', 45, 38, 15.56, 5000, 500],
    ['prod-003', 'Metformin 500mg', 'Dr. Reddys', 'Antidiabetics', 'METF-500-001', 28, 22, 21.43, 8000, 800],
    ['prod-004', 'Atorvastatin 10mg', 'Lupin', 'Cardiovascular', 'ATOR-010-001', 55, 45, 18.18, 6000, 600],
    ['prod-005', 'Omeprazole 20mg', 'Zydus', 'Gastrointestinal', 'OMEP-020-001', 32, 26, 18.75, 7000, 700],
    ['prod-006', 'Cetirizine 10mg', 'Mankind', 'Antihistamines', 'CETI-010-001', 18, 14, 22.22, 9000, 900],
    ['prod-007', 'Azithromycin 500mg', 'Cipla', 'Antibiotics', 'AZIT-500-001', 85, 70, 17.65, 4000, 400],
    ['prod-008', 'Pantoprazole 40mg', 'Sun Pharma', 'Gastrointestinal', 'PANT-040-001', 38, 30, 21.05, 5500, 550],
    ['prod-009', 'Amlodipine 5mg', 'Torrent', 'Cardiovascular', 'AMLO-005-001', 42, 35, 16.67, 7500, 750],
    ['prod-010', 'Montelukast 10mg', 'Glenmark', 'Respiratory', 'MONT-010-001', 95, 78, 17.89, 3500, 350],
  ]

  const tx = db.transaction(() => {
    for (const [id, name, company, category, sku, mrp, sell, disc, qty, reorder] of products) {
      ins.run(id, name, company, category, sku, mrp, sell, disc, company, qty, reorder, now, now)
    }
  })
  tx()

  console.log('✅ Initial data loaded (admin + products).')
}

export async function query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return db.prepare(sql).all(...params) as T[]
}

export async function queryOne<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | null> {
  return (db.prepare(sql).get(...params) as T) ?? null
}

export async function run(sql: string, params: unknown[] = []): Promise<{ changes: number; lastInsertRowid: number | bigint }> {
  return db.prepare(sql).run(...params)
}
