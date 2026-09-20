'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export const dynamic = 'force-dynamic'

/**
 * After NextAuth OAuth completes it redirects here.
 * We read the backend JWT from the session and store it in localStorage,
 * then forward the user to the right dashboard.
 */
export default function AuthCallbackPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return

    if (status === 'unauthenticated') {
      router.replace('/login')
      return
    }

    if (session) {
      const backendToken = (session as any).backendToken as string | undefined
      const role = (session as any).role as string | undefined

      if (backendToken) {
        localStorage.setItem('auth_token', backendToken)
      }

      if (role === 'ADMIN') router.replace('/admin/dashboard')
      else if (role === 'SALES_PERSON') router.replace('/sp/dashboard')
      else router.replace('/user/dashboard')
    }
  }, [session, status, router])

  return (
    <main className="min-h-screen flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #eef2ff 50%, #f5f3ff 100%)' }}>
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-xl shadow-blue-500/25 mb-2">
          <svg className="h-8 w-8 text-white animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
        <p className="text-slate-600 font-medium">Signing you in…</p>
      </div>
    </main>
  )
}
