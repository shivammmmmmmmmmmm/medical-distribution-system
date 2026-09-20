import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { initDatabase, getActiveDriver } from './db/index.js'
import authRoutes from './routes/auth.js'
import productRoutes from './routes/products.js'
import pricingRoutes from './routes/pricing.js'
import orderRoutes from './routes/orders.js'
import userRoutes from './routes/users.js'
import commissionRoutes from './routes/commissions.js'
import dashboardRoutes from './routes/dashboard.js'
import reportRoutes from './routes/reports.js'
import invoiceRoutes from './routes/invoices.js'
import auditRoutes from './routes/audit.js'
import areaRoutes from './routes/areas.js'
import uploadRoutes from './routes/uploads.js'
import cartRoutes from './routes/cart.js'
import categoryRoutes from './routes/categories.js'
import inventoryRoutes from './routes/inventory.js'
import accountingRoutes from './routes/accounting.js'
import notificationRoutes from './routes/notifications.js'
import spTerritoryRoutes from './routes/sp-territories.js'
import companyRoutes from './routes/companies.js'
import compositionRoutes from './routes/compositions.js'
import gstRateRoutes from './routes/gst-rates.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
const PORT = Number(process.env.PORT) || 3001

app.use(express.json({ limit: '10mb' }))

const isProd = process.env.NODE_ENV === 'production'
const allowedOrigins = (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || (isProd ? '' : 'http://localhost:3000'))
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

if (isProd && allowedOrigins.length === 0) {
  throw new Error('FRONTEND_URL or FRONTEND_URLS must be configured in production')
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
      return
    }
    callback(new Error('Origin is not allowed by CORS'))
  },
  credentials: true,
}))

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', database: getActiveDriver(), timestamp: new Date().toISOString() })
)

app.get('/api/health', (_req, res) =>
  res.json({ success: true, message: 'Backend is running' })
)

app.use('/api/auth', authRoutes)
app.use('/api/products', productRoutes)
app.use('/api/pricing', pricingRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/users', userRoutes)
app.use('/api/commissions', commissionRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/invoices', invoiceRoutes)
app.use('/api/audit', auditRoutes)
app.use('/api/areas', areaRoutes)
app.use('/api/uploads', uploadRoutes)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')))
app.use('/api/cart', cartRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/inventory', inventoryRoutes)
app.use('/api/accounting', accountingRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/sp-territories', spTerritoryRoutes)
app.use('/api/companies', companyRoutes)
app.use('/api/compositions', compositionRoutes)
app.use('/api/gst-rates', gstRateRoutes)

// ── Serve Next.js frontend in production ────────────────────────────────────
const frontendDist = process.env.FRONTEND_DIST || path.join(__dirname, '..', '..', 'frontend', '.next')
if (isProd && fs.existsSync(frontendDist)) {
  // Next.js static assets (/_next/*)
  app.use('/_next', express.static(path.join(frontendDist, 'static')))
  // Public assets
  const publicDir = path.join(__dirname, '..', '..', 'frontend', 'public')
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir))
  }
  // Catch-all: serve Next.js HTML for client-side routing
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendDist, 'server', 'pages', 'index.html'))
  })
}

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ success: false, error: 'Internal server error' })
})

async function start() {
  try {
    await initDatabase()
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n✅ Medical Distribution API running on port ${PORT}`)
      console.log(`   Health: http://localhost:${PORT}/health\n`)
    })
    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n❌ Port ${PORT} in use. Run: npm run kill-port\n`)
        process.exit(1)
      }
      throw err
    })
    process.on('SIGINT', () => server.close(() => process.exit(0)))
    process.on('SIGTERM', () => server.close(() => process.exit(0)))
  } catch (err) {
    console.error('\n❌ Failed to start server.')
    console.error('   Try: set DB_DRIVER=sqlite in .env  OR  restart MySQL in XAMPP')
    console.error('   Test MySQL: npm run db:test\n')
    console.error(err)
    process.exit(1)
  }
}

start()

export default app
