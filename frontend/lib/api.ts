import type { ApiResponse, PaginatedResponse, User, Product, Order, LedgerEntry, Commission, LoginResponse, LoginRequest, RegisterRequest } from './types'
import { API_BASE, getApiConfigurationError } from './api-config'

function token() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('auth_token')
}

function headers(extra?: Record<string, string>): HeadersInit {
  const t = token()
  return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}), ...extra }
}

async function req<T>(method: string, path: string, body?: any, signal?: AbortSignal): Promise<T> {
  if (!API_BASE) throw getApiConfigurationError()

  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: headers(),
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      ...(signal ? { signal } : {}),
    })
  } catch (error) {
    console.error(`API request failed: ${method} ${path}`, error)
    throw new Error('Unable to connect to the server. Please try again.')
  }

  // Some backends (or auth redirects) may return HTML.
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    const text = await res.text().catch(() => '')
    if (!res.ok) {
      throw new Error(text ? `Request failed (${res.status}): ${text.slice(0, 300)}` : `Request failed: ${res.status}`)
    }
    throw new Error(`Expected JSON but received ${contentType || 'unknown content-type'}`)
  }

  const json: ApiResponse<T> = await res.json()
  if (!res.ok) throw new Error(json.error || `Request failed: ${res.status}`)
  return json.data as T
}



// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (d: LoginRequest) => req<LoginResponse>('POST', '/auth/login', d),
  register: (d: RegisterRequest) => req<LoginResponse>('POST', '/auth/register', d),
  me: () => req<User>('GET', '/auth/me'),
}

// ── Products ──────────────────────────────────────────────────────────────────
export const productsApi = {
  list: (p?: { search?: string; category?: string; ingredient?: string; company?: string; companyId?: string; compositionId?: string; dosageForm?: string; page?: number; pageSize?: number }) => {
    const q = new URLSearchParams()
    if (p?.search) q.set('search', p.search)
    if (p?.category) q.set('category', p.category)
    if (p?.ingredient) q.set('ingredient', p.ingredient)
    if (p?.company) q.set('company', p.company)
    if (p?.companyId) q.set('companyId', p.companyId)
    if (p?.compositionId) q.set('compositionId', p.compositionId)
    if (p?.dosageForm) q.set('dosageForm', p.dosageForm)
    if (p?.page) q.set('page', String(p.page))
    if (p?.pageSize) q.set('pageSize', String(p.pageSize))
    return req<PaginatedResponse<Product>>('GET', `/products${q.toString() ? `?${q}` : ''}`)
  },
  get: (id: string) => req<Product>('GET', `/products/${id}`),
  categories: () => req<string[]>('GET', '/products/categories'),
  filterOptions: (p?: { dosageForm?: string; companyId?: string; compositionId?: string }) => {
    const q = new URLSearchParams()
    if (p?.dosageForm) q.set('dosageForm', p.dosageForm)
    if (p?.companyId) q.set('companyId', p.companyId)
    if (p?.compositionId) q.set('compositionId', p.compositionId)
    return req<{ dosageForms: string[]; companies: { id: string; name: string }[]; products: { id: string; name: string }[]; compositions: { id: string; name: string }[] }>(
      'GET', `/products/filter-options${q.toString() ? `?${q}` : ''}`
    )
  },
  create: (d: Partial<Product>) => req<Product>('POST', '/products', d),
  update: (id: string, d: Partial<Product>) => req<Product>('PUT', `/products/${id}`, d),
  delete: (id: string) => req<void>('DELETE', `/products/${id}`),
}

// ── Orders ────────────────────────────────────────────────────────────────────
export const ordersApi = {
  list: (p?: { status?: string; page?: number }) => {
    const q = new URLSearchParams()
    if (p?.status) q.set('status', p.status)
    if (p?.page) q.set('page', String(p.page))
    return req<PaginatedResponse<Order>>('GET', `/orders${q.toString() ? `?${q}` : ''}`)
  },
  get: (id: string) => req<Order>('GET', `/orders/${id}`),
  create: (d: { items: { productId: string; quantity: number }[]; paymentMethod: string; shippingAddress?: string; notes?: string; targetUserId?: string }) =>
    req<Order>('POST', '/orders', d),
  updateStatus: (id: string, status: string) => req<Order>('PATCH', `/orders/${id}/status`, { status }),
  recordPayment: (id: string, amount: number) => req<Order>('POST', `/orders/${id}/payment`, { amount }),
  updateDelivery: (id: string, d: { trackingCode?: string; deliveryNotes?: string; status?: string }) =>
    req<Order>('PATCH', `/orders/${id}/delivery`, d),
  uploadPaymentProof: (id: string, screenshotDataUrl: string, fileName?: string) =>
    req<Order>('POST', `/orders/${id}/payment-proof`, { screenshotDataUrl, fileName }),
  notifyReceipt: (id: string) => req<Order>('POST', `/orders/${id}/notify-receipt`),
  confirmReceipt: (id: string, received: boolean, remark?: string) =>
    req<Order>('POST', `/orders/${id}/confirm-receipt`, { received, remark }),
  // 🆕 New workflow endpoints
  verifyPayment: (id: string) => req<Order>('POST', `/orders/${id}/verify-payment`),
  requestDispatch: (id: string) => req<Order>('POST', `/orders/${id}/request-dispatch`),
  submitTracking: (id: string, d: { trackingCode?: string; deliveryNotes?: string; courierScreenshot?: string }) =>
    req<Order>('POST', `/orders/${id}/submit-tracking`, d),
  // Legacy endpoints
  sendDeliveryMessage: (id: string) => req<Order>('POST', `/orders/${id}/send-delivery-message`),
  confirmDeliveryProof: (id: string, d: { deliveryScreenshot?: string; paymentScreenshot?: string; paymentFileName?: string }) =>
    req<Order>('POST', `/orders/${id}/confirm-delivery-proof`, d),
  customerDeliveryResponse: (id: string, received: boolean, remark?: string) =>
    req<Order>('POST', `/orders/${id}/customer-delivery-response`, { received, remark }),
  spPendingVerification: () => req<Order[]>('GET', '/orders/sp-pending-verification'),
}

export const notificationsApi = {
  list: () => req<{ notifications: import('./types').AppNotification[]; unreadCount: number }>('GET', '/notifications'),
  markRead: (id: string) => req<void>('PATCH', `/notifications/${id}/read`),
  markAllRead: () => req<void>('POST', '/notifications/read-all'),
  delete: (id: string) => req<void>('DELETE', `/notifications/${id}`),
}

export const cartApi = {
  list: () => req<any[]>('GET', '/cart'),
  add: (productId: string, quantity: number) => req<void>('POST', '/cart', { productId, quantity }),
  update: (productId: string, quantity: number) => req<void>('PUT', `/cart/${productId}`, { quantity }),
  clear: () => req<void>('DELETE', '/cart'),
}

export const categoriesApi = {
  list: () => req<{ id: string; name: string; description?: string }[]>('GET', '/categories'),
  create: (d: { name: string; description?: string }) => req<any>('POST', '/categories', d),
  update: (id: string, d: any) => req<any>('PUT', `/categories/${id}`, d),
  delete: (id: string) => req<void>('DELETE', `/categories/${id}`),
}

export const companiesApi = {
  list: (p?: { search?: string; activeOnly?: boolean }) => {
    const q = new URLSearchParams()
    if (p?.search) q.set('search', p.search)
    if (p?.activeOnly === false) q.set('activeOnly', '0')
    return req<import('./types').Company[]>('GET', `/companies${q.toString() ? `?${q}` : ''}`)
  },
  get: (id: string) => req<import('./types').Company>('GET', `/companies/${id}`),
  create: (d: Partial<import('./types').Company>) => req<import('./types').Company>('POST', '/companies', d),
  update: (id: string, d: Partial<import('./types').Company>) => req<import('./types').Company>('PUT', `/companies/${id}`, d),
  delete: (id: string) => req<void>('DELETE', `/companies/${id}`),
}

export const compositionsApi = {
  list: (p?: { search?: string; activeOnly?: boolean }) => {
    const q = new URLSearchParams()
    if (p?.search) q.set('search', p.search)
    if (p?.activeOnly === false) q.set('activeOnly', '0')
    return req<import('./types').Composition[]>('GET', `/compositions${q.toString() ? `?${q}` : ''}`)
  },
  create: (d: { name: string; description?: string }) => req<import('./types').Composition>('POST', '/compositions', d),
  update: (id: string, d: Partial<import('./types').Composition>) => req<import('./types').Composition>('PUT', `/compositions/${id}`, d),
  delete: (id: string) => req<void>('DELETE', `/compositions/${id}`),
}

export const gstRatesApi = {
  list: (activeOnly = true) => req<import('./types').GstRate[]>('GET', `/gst-rates${activeOnly ? '' : '?activeOnly=0'}`),
  create: (d: { name: string; code?: string; percentage: number }) => req<import('./types').GstRate>('POST', '/gst-rates', d),
  update: (id: string, d: Partial<import('./types').GstRate>) => req<import('./types').GstRate>('PUT', `/gst-rates/${id}`, d),
  delete: (id: string) => req<void>('DELETE', `/gst-rates/${id}`),
}

export const productFilterOptionsApi = {
  get: (p?: { dosageForm?: string; companyId?: string; compositionId?: string }) => {
    const q = new URLSearchParams()
    if (p?.dosageForm) q.set('dosageForm', p.dosageForm)
    if (p?.companyId) q.set('companyId', p.companyId)
    if (p?.compositionId) q.set('compositionId', p.compositionId)
    return req<{
      dosageForms: string[]
      companies: { id: string; name: string }[]
      products: { id: string; name: string }[]
      compositions: { id: string; name: string }[]
    }>('GET', `/products/filter-options${q.toString() ? `?${q}` : ''}`)
  },
}

export const inventoryApi = {
  lowStock: () => req<any[]>('GET', '/inventory/low-stock'),
  alerts: () => req<{ lowStockCount: number; expiringSoonCount: number }>('GET', '/inventory/alerts'),
  adjust: (productId: string, delta: number, reason?: string) =>
    req<any>('POST', '/inventory/adjust', { productId, delta, reason }),
  history: () => req<any[]>('GET', '/inventory/history'),
}

export const accountingApi = {
  summary: (p?: { paymentMethod?: string; status?: string; from?: string; to?: string }) => {
    const q = new URLSearchParams()
    if (p?.paymentMethod) q.set('paymentMethod', p.paymentMethod)
    if (p?.status) q.set('status', p.status)
    if (p?.from) q.set('from', p.from)
    if (p?.to) q.set('to', p.to)
    return req<any>('GET', `/accounting/summary${q.toString() ? `?${q}` : ''}`)
  },
  backup: () => req<any>('GET', '/accounting/backup'),
  backupHistory: () => req<any[]>('GET', '/accounting/backup-history'),
}

// ── Users ─────────────────────────────────────────────────────────────────────
export const usersApi = {
  list: (p?: { role?: string; page?: number; pageSize?: number; approvalStatus?: string }) => {
    const q = new URLSearchParams()
    if (p?.role) q.set('role', p.role)
    if (p?.approvalStatus) q.set('approvalStatus', p.approvalStatus)
    if (p?.page) q.set('page', String(p.page))
    if (p?.pageSize) q.set('pageSize', String(p.pageSize))
    return req<PaginatedResponse<User>>('GET', `/users${q.toString() ? `?${q}` : ''}`)
  },
  get: (id: string) => req<User>('GET', `/users/${id}`),
  create: (d: any) => req<User>('POST', '/users', d),
  update: (id: string, d: Partial<User> & { isBlocked?: boolean; isActive?: boolean }) => req<User>('PUT', `/users/${id}`, d),
  setCredit: (id: string, creditLimit: number) => req<User>('PATCH', `/users/${id}/credit`, { creditLimit }),
  ledger: (id: string) => req<LedgerEntry[]>('GET', `/users/${id}/ledger`),
  approve: (id: string, approved: boolean, opts?: { creditLimit?: number; spCommissionPct?: number; rejectionRemark?: string }) =>
    req<User>('PATCH', `/users/${id}/approve`, { approved, ...opts }),
}

export const reportsApi = {
  sales: () => req<any>('GET', '/reports/sales'),
  areaWise: () => req<any[]>('GET', '/reports/area-wise'),
  products: () => req<any[]>('GET', '/reports/products'),
  pendingPayments: () => req<any[]>('GET', '/reports/pending-payments'),
  commissions: () => req<any[]>('GET', '/reports/commissions'),
  exportCsv: (type: string) => {
    const t = token()
    return fetch(`${BASE}/reports/export?type=${type}`, {
      headers: t ? { Authorization: `Bearer ${t}` } : {},
    })
  },
}

export const invoicesApi = {
  get: (orderId: string) => req<any>('GET', `/invoices/${orderId}`),
}

export const auditApi = {
  list: (page = 1) => req<PaginatedResponse<any>>('GET', `/audit?page=${page}`),
}

export const areasApi = {
  list: () => req<{ id: string; name: string; description?: string; latitude?: number | null; longitude?: number | null; sourceMode?: 'ONLINE' | 'OFFLINE' | null }[]>('GET', '/areas'),
  create: (d: { name: string; description?: string; latitude?: number | null; longitude?: number | null; sourceMode?: 'ONLINE' | 'OFFLINE' }) => req<any>('POST', '/areas', d),
  update: (id: string, d: any) => req<any>('PUT', `/areas/${id}`, d),
}

export const uploadsApi = {
  upload: (d: { docType: string; fileName: string; dataUrl: string; targetUserId?: string }) =>
    req<{ url: string }>('POST', '/uploads', d),
}

// ── Commissions ───────────────────────────────────────────────────────────────
export const commissionsApi = {
  list: (p?: { status?: string; spId?: string; customerId?: string; from?: string; to?: string }) => {
    const q = new URLSearchParams()
    if (p?.status) q.set('status', p.status)
    if (p?.spId) q.set('spId', p.spId)
    if (p?.customerId) q.set('customerId', p.customerId)
    if (p?.from) q.set('from', p.from)
    if (p?.to) q.set('to', p.to)
    return req<Commission[]>('GET', `/commissions${q.toString() ? `?${q}` : ''}`)
  },
  report: (p?: { status?: string; customerId?: string; from?: string; to?: string }) => {
    const q = new URLSearchParams()
    if (p?.status) q.set('status', p.status)
    if (p?.customerId) q.set('customerId', p.customerId)
    if (p?.from) q.set('from', p.from)
    if (p?.to) q.set('to', p.to)
    return req<any[]>('GET', `/commissions/report${q.toString() ? `?${q}` : ''}`)
  },
  pay: (id: string) => req<void>('PATCH', `/commissions/${id}/pay`),
  pendingOrders: () => req<any[]>('GET', '/commissions/pending-orders'),
  createFromOrder: (orderId: string, commissionPct: number) =>
    req<Commission>('POST', '/commissions/from-order', { orderId, commissionPct }),
  verify: (id: string) => req<any>('GET', `/commissions/${id}/verify`),
  awaitingVerification: () => req<any[]>('GET', '/commissions/admin/awaiting-verification'),
  approve: (id: string) => req<Commission>('POST', `/commissions/${id}/approve`),
  // 🆕 Release commission directly (after user confirms receipt)
  release: (id: string) => req<Commission>('POST', `/commissions/${id}/release`),
  // 🆕 Get orders ready for commission release (customer confirmed receipt)
  readyForRelease: () => req<any[]>('GET', '/commissions/admin/ready-for-release'),
}

// ── SP Territories ────────────────────────────────────────────────────────────
export const spTerritoriesApi = {
  list: () => req<{ id: string; name: string; address?: string; latitude: number; longitude: number; notes?: string; isActive: boolean; createdAt: string }[]>('GET', '/sp-territories'),
  create: (d: { name: string; address?: string; latitude: number; longitude: number; notes?: string }) =>
    req<any>('POST', '/sp-territories', d),
  update: (id: string, d: any) => req<any>('PUT', `/sp-territories/${id}`, d),
  delete: (id: string) => req<void>('DELETE', `/sp-territories/${id}`),
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const dashboardApi = {
  get: () => req<any>('GET', '/dashboard'),
}

// ── Pricing ───────────────────────────────────────────────────────────────────
export const pricingApi = {
  list: () => req<PaginatedResponse<any>>('GET', '/pricing'),
  create: (d: any) => req<any>('POST', '/pricing', d),
  update: (id: string, d: any) => req<any>('PUT', `/pricing/${id}`, d),
  delete: (id: string) => req<void>('DELETE', `/pricing/${id}`),
}
