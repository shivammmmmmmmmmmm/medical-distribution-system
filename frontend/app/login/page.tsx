'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { authClient } from '@/lib/auth-client'
import { Spinner } from '@/components/Loader'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await authClient.login({ email, password })
      if (result.user.role === 'ADMIN') router.push('/admin/dashboard')
      else if (result.user.role === 'SALES_PERSON') router.push('/sp/dashboard')
      else router.push('/user/dashboard')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Google Fonts — Cinzel + Allura + Poppins — only for login page */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Allura&family=Cinzel:wght@600;700&family=Poppins:wght@400;500;600;700&display=swap');
        .login-allura   { font-family: 'Allura', cursive; }
        .login-cinzel   { font-family: 'Cinzel', serif; }
        .login-poppins  { font-family: 'Poppins', sans-serif; }
      `}</style>

      <main className="login-poppins min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden">
        {/* Full-page background image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/loginbg.jpeg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-25px object-cover object-center"
        />

        {/* Soft overlay so card stays readable */}
        <div className="absolute inset-0 bg-white/30 backdrop-blur-[2px]" />

        <div className="w-full max-w-md relative z-10">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/tirumala logo.jpeg"
                alt="Tirumala Pharmaceutical"
                className="h-20 w-20 object-contain"
              />
            </div>
  
            <h1 className="login-cinzel text-2xl font-semibold tracking-wide">
              <span className="text-black">Tirumala</span>{' '}
              <span className="text-green-600">Pharmaceutical</span>
            </h1>

            <p className="login-allura text-3xl text-green-700 mt-2 leading-tight">Welcome Back!</p>
            <p className="login-allura text-2xl text-slate-600 mt-1">Please sign in to continue</p>
          </div>

          {/* Card */}
          <div className="bg-white/85 backdrop-blur-xl rounded-3xl shadow-2xl shadow-green-900/15 border border-white/70 p-7">
            {/* Error */}
            {error && (
              <div className="mb-4 flex items-start gap-2.5 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
                <svg className="h-4 w-4 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="login-allura block text-xl text-slate-600 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  placeholder="you@example.com"
                  className="login-poppins input-base"
                />
              </div>

              <div>
                <label className="login-allura block text-xl text-slate-600 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="login-poppins input-base pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label={showPass ? 'Hide password' : 'Show password'}
                  >
                    {showPass ? (
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="login-allura btn-press w-full py-3 rounded-xl text-xl text-white bg-gradient-to-r from-green-700 to-green-600 hover:from-green-800 hover:to-green-700 shadow-lg shadow-green-700/25 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-1"
              >
                {loading && <Spinner className="h-4 w-4 text-white" />}
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>

            <p className="login-allura mt-5 text-center text-2xl text-slate-500">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="text-green-700 hover:text-green-800 transition-colors">
                Create account
              </Link>
            </p>
          </div>

          <p className="login-allura text-center text-2xl text-slate-900 mt-5 drop-shadow">
            Medical Distribution System · Secure Login
          </p>
        </div>
      </main>
    </>
  )
}



