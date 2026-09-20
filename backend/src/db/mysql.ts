import mysql, { type Pool, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise'
import { hashPassword } from '../utils/auth.js'

const config = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME || 'medical_db',
  connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT) || 5000,
}

let pool: Pool

export function getDriverName() {
  return 'mysql' as const
}

export async function initDatabase(): Promise<void> {
  const bootstrap = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    connectTimeout: config.connectTimeout,
  })
  await bootstrap.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\``)
  await bootstrap.end()

  pool = mysql.createPool({
    ...config,
    waitForConnections: true,
    connectionLimit: 10,
    dateStrings: true,
  })

  await ensureSchema()
  await seedIfEmpty()
  console.log(`✅ MySQL connected: ${config.database} @ ${config.host}:${config.port}`)
}

async function ensureSchema(): Promise<void> {
  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(36) PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      role ENUM('ADMIN','SALES_PERSON','USER') NOT NULL,
      customer_type ENUM('DISTRIBUTOR','HOSPITAL','CLINIC','PHARMACY') NULL,
      phone VARCHAR(50) NULL,
      organization_name VARCHAR(255) NULL,
      address TEXT NULL,
      territory VARCHAR(100) NULL,
      assigned_sp_id VARCHAR(36) NULL,
      commission_pct DECIMAL(5,2) DEFAULT 0,
      credit_limit DECIMAL(12,2) DEFAULT 0,
      credit_used DECIMAL(12,2) DEFAULT 0,
      is_blocked TINYINT NOT NULL DEFAULT 0,
      is_active TINYINT NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      last_login DATETIME NULL
    )`,
    `CREATE TABLE IF NOT EXISTS products (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      company_name VARCHAR(255) NULL,
      category VARCHAR(100) NULL,
      description TEXT NULL,
      ingredients TEXT NULL,
      strength VARCHAR(100) NULL,
      dosage_form VARCHAR(100) NULL,
      mrp DECIMAL(12,2) DEFAULT 0,
      selling_price DECIMAL(12,2) DEFAULT 0,
      discount_pct DECIMAL(5,2) DEFAULT 0,
      sku VARCHAR(100) UNIQUE NOT NULL,
      manufacturer VARCHAR(255) NULL,
      quantity INT NOT NULL DEFAULT 0,
      reorder_level INT NOT NULL DEFAULT 0,
      image_url VARCHAR(500) NULL,
      is_active TINYINT NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS orders (
      id VARCHAR(36) PRIMARY KEY,
      order_number VARCHAR(50) UNIQUE NOT NULL,
      user_id VARCHAR(36) NOT NULL,
      sp_id VARCHAR(36) NULL,
      status ENUM('PENDING','APPROVED','DISPATCHED','DELIVERED','COMPLETED','CANCELLED') NOT NULL DEFAULT 'PENDING',
      payment_method ENUM('CREDIT','UPI','BANK_TRANSFER','CASH') DEFAULT 'CREDIT',
      payment_status ENUM('PENDING','PARTIAL','PAID') DEFAULT 'PENDING',
      subtotal DECIMAL(12,2) DEFAULT 0,
      discount_amount DECIMAL(12,2) DEFAULT 0,
      total_amount DECIMAL(12,2) DEFAULT 0,
      paid_amount DECIMAL(12,2) DEFAULT 0,
      notes TEXT NULL,
      shipping_address TEXT NULL,
      delivered_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS order_items (
      id VARCHAR(36) PRIMARY KEY,
      order_id VARCHAR(36) NOT NULL,
      product_id VARCHAR(36) NOT NULL,
      product_name VARCHAR(255) NOT NULL,
      quantity INT NOT NULL,
      unit_price DECIMAL(12,2) NOT NULL,
      discount_pct DECIMAL(5,2) DEFAULT 0,
      total_price DECIMAL(12,2) NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS ledger (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      type ENUM('DEBIT','CREDIT') NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      balance_after DECIMAL(12,2) NOT NULL,
      description VARCHAR(500) NOT NULL,
      reference_id VARCHAR(36) NULL,
      reference_type VARCHAR(50) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS commissions (
      id VARCHAR(36) PRIMARY KEY,
      sp_id VARCHAR(36) NOT NULL,
      order_id VARCHAR(36) NOT NULL,
      order_amount DECIMAL(12,2) NOT NULL,
      commission_pct DECIMAL(5,2) NOT NULL,
      commission_amount DECIMAL(12,2) NOT NULL,
      status ENUM('PENDING','APPROVED','PAID') NOT NULL DEFAULT 'PENDING',
      paid_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS product_pricing (
      id VARCHAR(36) PRIMARY KEY,
      product_id VARCHAR(36) NOT NULL,
      role ENUM('ADMIN','SALES_PERSON','USER') NOT NULL,
      price DECIMAL(12,2) NOT NULL,
      min_quantity INT NOT NULL DEFAULT 1,
      max_quantity INT NULL,
      effective_from DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      effective_to DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
  ]
  for (const sql of tables) await pool.query(sql)
  try {
    await pool.query(
      `ALTER TABLE users ADD COLUMN customer_type ENUM('DISTRIBUTOR','HOSPITAL','CLINIC','PHARMACY') NULL`
    )
  } catch {
    /* exists */
  }
}

async function seedIfEmpty(): Promise<void> {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim()
  const adminPassword = process.env.SEED_ADMIN_PASSWORD
  if (adminEmail && adminPassword) {
    const row = await queryOne<RowDataPacket>('SELECT id FROM users WHERE email = ?', [adminEmail])
    if (!row) {
      const adminHash = await hashPassword(adminPassword)
      await run(
        `INSERT INTO users (id,email,password_hash,name,role,organization_name,is_active,created_at,updated_at)
         VALUES (?,?,?,?,?,?,1,?,?)`,
        ['admin-001', adminEmail, adminHash, 'System Admin', 'ADMIN', 'Medical Distribution Co.', now, now]
      )
    }
  }

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

  for (const [id, name, company, category, sku, mrp, sell, disc, qty, reorder] of products) {
    await run(
      `INSERT INTO products (id,name,company_name,category,sku,mrp,selling_price,discount_pct,manufacturer,quantity,reorder_level,is_active,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,1,?,?)`,
      [id, name, company, category, sku, mrp, sell, disc, company, qty, reorder, now, now]
    )
  }

  console.log('✅ Initial data loaded (admin + products).')
}

export async function query<T = RowDataPacket>(sql: string, params: unknown[] = []): Promise<T[]> {
  const [rows] = await pool.query<RowDataPacket[]>(sql, params)
  return rows as T[]
}

export async function queryOne<T = RowDataPacket>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params)
  return rows[0] ?? null
}

export async function run(sql: string, params: unknown[] = []): Promise<ResultSetHeader> {
  const [result] = await pool.query<ResultSetHeader>(sql, params)
  return result
}

export function getPool(): Pool {
  return pool
}
