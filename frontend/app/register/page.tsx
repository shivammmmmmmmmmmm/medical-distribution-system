'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { authClient } from '@/lib/auth-client'
import { getErrorMessage } from '@/lib/api-config'
import FileUpload from '@/components/FileUpload'
import { Spinner } from '@/components/Loader'
import type { AccountRole } from '@/lib/types'

const ROLE_OPTIONS: { label: string; value: AccountRole; icon: string; desc: string }[] = [
  { label: 'Pharmacy',     value: 'PHARMACY',     icon: '💊', desc: 'Retail pharmacy' },
  { label: 'Clinic',       value: 'CLINIC',       icon: '🏥', desc: 'Medical clinic' },
  { label: 'Hospital',     value: 'HOSPITAL',     icon: '🏨', desc: 'Hospital / healthcare' },
  { label: 'Distributor',  value: 'DISTRIBUTOR',  icon: '📦', desc: 'Wholesale distributor' },
  { label: 'Sales Person', value: 'SALES_PERSON', icon: '👤', desc: 'Sales representative' },
  { label: 'Administrator',value: 'ADMINISTRATOR',icon: '🔐', desc: 'System admin' },
]

function dashboardPath(role: string) {
  if (role === 'ADMIN') return '/admin/dashboard'
  if (role === 'SALES_PERSON') return '/sp/dashboard'
  return '/user/dashboard'
}

export default function RegisterPage() {
  const [name, setName]             = useState('')
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [showPass, setShowPass]     = useState(false)
  const [accountRole, setAccountRole] = useState<AccountRole>('PHARMACY')
  const [organizationName, setOrganizationName] = useState('')
  const [phone, setPhone]           = useState('')
  const [address, setAddress]       = useState('')
  const [licenseDoc, setLicenseDoc] = useState('')
  const [error, setError]           = useState('')
  const [success, setSuccess]       = useState('')
  const [loading, setLoading]       = useState(false)
  const router = useRouter()

  const isSales    = accountRole === 'SALES_PERSON'
  const isBusiness = ['DISTRIBUTOR', 'HOSPITAL', 'CLINIC', 'PHARMACY'].includes(accountRole)
  const selected   = ROLE_OPTIONS.find(r => r.value === accountRole)!

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true)
    try {
      const result = await authClient.register({
        email, password, name, accountRole,
        phone: phone || undefined,
        address: address || undefined,
        organizationName: organizationName || undefined,
        documents: licenseDoc
          ? [{ docType: 'license', dataUrl: licenseDoc, fileName: 'license.pdf' }]
          : undefined,
      } as any)
      if (result.pendingApproval) {
        setSuccess(result.message || 'Registration submitted. Wait for admin approval.')
        return
      }
      if (result.token) router.push(dashboardPath(result.user.role))
    } catch (err: unknown) {
        console.error('Registration failed', err)
        setError(getErrorMessage(err, 'Registration failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Same fonts as login page */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Allura&family=Cinzel:wght@600;700&family=Poppins:wght@400;500;600;700&display=swap');
        .reg-allura  { font-family: 'Allura', cursive; }
        .reg-cinzel  { font-family: 'Cinzel', serif; }
        .reg-poppins { font-family: 'Poppins', sans-serif; }
      `}</style>

      <main className="reg-poppins min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden">

        {/* Same background image as login */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/loginbg.jpeg" alt="" aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover object-center" />
        <div className="absolute inset-0 bg-white/30 backdrop-blur-[2px]" />

        <div className="relative w-full max-w-md z-10">

          {/* Header — identical to login */}
          <div className="text-center mb-6">
            <div className="flex justify-center mb-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/tirumala logo.jpeg" alt="Tirumala Pharmaceutical"
                className="h-20 w-20 object-contain" />
            </div>
            <h1 className="reg-cinzel text-2xl font-semibold tracking-wide">
              <span className="text-black">Tirumala</span>{' '}
              <span className="text-green-600">Pharmaceutical</span>
            </h1>
            <p className="reg-allura text-3xl text-green-700 mt-1 leading-tight">Create Account</p>
            <p className="reg-allura text-2xl text-slate-600 mt-0.5">Join us today</p>
          </div>

          <div className="bg-white/85 backdrop-blur-xl rounded-3xl shadow-2xl shadow-green-900/15 border border-white/70 p-6 sm:p-8">
            {error && (
              <div className="mb-4 flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
                <svg className="h-4 w-4 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 flex items-start gap-2 p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-sm text-emerald-800">
                <svg className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M20 6L9 17l-5-5"/></svg>
                <div>
                  <p className="font-semibold">Registration submitted</p>
                  <p className="text-emerald-700 mt-0.5">{success}</p>
                  <Link href="/login" className="mt-2 inline-block font-semibold text-emerald-700 hover:underline">
                    Back to login →
                  </Link>
                </div>
              </div>
            )}

            {!success && (
              <form onSubmit={handleSubmit} className="space-y-4">

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="reg-allura text-xl text-slate-400">or</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>

                {/* Account type */}
                <div>
                  <label className="reg-allura block text-xl text-slate-600 mb-2">Account Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {ROLE_OPTIONS.map(r => (
                      <button key={r.value} type="button" onClick={() => setAccountRole(r.value)}
                        className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-center transition-all duration-150 btn-press ${
                          accountRole === r.value
                            ? 'border-green-400 bg-green-50 shadow-sm shadow-green-100'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}>
                        <span className="text-xl">{r.icon}</span>
                        <span className={`reg-allura text-sm leading-tight ${accountRole === r.value ? 'text-green-700' : 'text-slate-600'}`}>
                          {r.label}
                        </span>
                      </button>
                    ))}
                  </div>
                  {isSales && (
                    <p className="mt-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                      Sales accounts get territory dashboards and commission tracking.
                    </p>
                  )}
                </div>

                {/* Fields */}
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="reg-allura block text-xl text-slate-600 mb-1.5">Full Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} required
                      placeholder="Your full name" className="reg-poppins input-base" />
                  </div>
                  <div>
                    <label className="reg-allura block text-xl text-slate-600 mb-1.5">Email</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                      placeholder="you@example.com" className="reg-poppins input-base" />
                  </div>
                  <div>
                    <label className="reg-allura block text-xl text-slate-600 mb-1.5">Password</label>
                    <div className="relative">
                      <input type={showPass ? 'text' : 'password'} value={password}
                        onChange={e => setPassword(e.target.value)} required minLength={6}
                        placeholder="Min. 6 characters" className="reg-poppins input-base pr-10" />
                      <button type="button" onClick={() => setShowPass(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {showPass
                          ? <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                          : <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        }
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="reg-allura block text-xl text-slate-600 mb-1.5">Phone</label>
                      <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                        placeholder="+91 XXXXX XXXXX" className="reg-poppins input-base" />
                    </div>
                    <div>
                      <label className="reg-allura block text-xl text-slate-600 mb-1.5">
                        {isBusiness ? 'Org Name' : 'Organization'}
                      </label>
                      <input type="text" value={organizationName} onChange={e => setOrganizationName(e.target.value)}
                        placeholder={isBusiness ? 'Business name' : 'Optional'} className="reg-poppins input-base" />
                    </div>
                  </div>
                  <div>
                    <label className="reg-allura block text-xl text-slate-600 mb-1.5">Address</label>
                    <input type="text" value={address} onChange={e => setAddress(e.target.value)}
                      placeholder="Shop / clinic address" className="reg-poppins input-base" />
                  </div>
                  {accountRole !== 'ADMINISTRATOR' && (
                    <div>
                      <label className="reg-allura block text-xl text-slate-600 mb-1.5">Drug License / Document</label>
                      <FileUpload label="Upload license or registration" onFile={setLicenseDoc} />
                    </div>
                  )}
                </div>

                <button type="submit" disabled={loading}
                  className="reg-allura btn-press w-full py-3 rounded-xl text-xl text-white bg-gradient-to-r from-green-700 to-green-600 hover:from-green-800 hover:to-green-700 shadow-lg shadow-green-700/25 transition-all duration-200 disabled:opacity-60 flex items-center justify-center gap-2 mt-2">
                  {loading && <Spinner className="h-4 w-4 text-white" />}
                  {loading ? 'Creating account…' : `Create ${selected.label} Account`}
                </button>
              </form>
            )}

            <p className="reg-allura mt-5 text-center text-2xl text-slate-500">
              Already have an account?{' '}
              <Link href="/login" className="text-green-700 hover:text-green-800 transition-colors">
                Sign in
              </Link>
            </p>
          </div>

          <p className="reg-allura text-center text-2xl text-slate-900 mt-5 drop-shadow">
            Medical Distribution System · Secure Login
          </p>
        </div>
      </main>
    </>
  )
}
