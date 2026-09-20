'use client'

import { useState } from 'react'
import { UPLOAD_BASE } from '@/lib/api-config'

/**
 * Helper to convert relative upload paths to full URLs.
 * Relative paths like /uploads/xxx.jpg get resolved to http://localhost:3001/uploads/xxx.jpg
 */
export function getScreenshotUrl(url: string | null | undefined): string | null {
  if (!url) return null

  const raw = String(url).trim()
  if (!raw) return null

  // Absolute URL
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw

  // Normalize path separators (backend may return windows-style paths)
  const normalized = raw.replace(/\\/g, '/')

  // If already looks like /uploads/<file>
  if (normalized.startsWith('/uploads/')) return `${UPLOAD_BASE}${normalized}`

  // Extract uploads/<possibly/nested/file> from any saved path.
  const m = normalized.match(/(?:^|\/)uploads\/(.+)$/)
  if (m?.[1]) {
    return `${UPLOAD_BASE}/uploads/${m[1].replace(/^\/+/, '')}`
  }

  // Extract /uploads/<file> substring anywhere in the string
  const uploadsIndex = normalized.indexOf('/uploads/')
  if (uploadsIndex >= 0) {
    const uploadsPath = normalized.slice(uploadsIndex) // /uploads/<file>
    return `${UPLOAD_BASE}${uploadsPath}`
  }

  // If it's bare like uploads/<file>
  if (normalized.startsWith('uploads/')) {
    return `${UPLOAD_BASE}/uploads/${normalized.slice('uploads/'.length)}`
  }

  // Fallback: keep whatever it is (might already be a valid path)
  return normalized
}

/**
 * ScreenshotView - Shows a clickable thumbnail that opens a full-size modal view.
 * Handles the URL resolution from relative backend paths to absolute URLs.
 */
export default function ScreenshotView({
  url,
  label = 'View screenshot',
  className = '',
}: {
  url: string | null | undefined
  label?: string
  className?: string
}) {
  const [showModal, setShowModal] = useState(false)
  const [failed, setFailed] = useState(false)
  const fullUrl = getScreenshotUrl(url)

  if (!fullUrl) return null

  return (
    <>
      <div className={`inline-flex flex-col gap-2 ${className}`}>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setShowModal(true)
          }}
          className="group overflow-hidden rounded-lg border border-slate-200 bg-white text-left shadow-sm transition hover:border-blue-300 hover:shadow-md"
        >
          <span className="block h-28 w-40 bg-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fullUrl}
              alt={label}
              className="h-full w-full object-contain"
              onError={() => setFailed(true)}
            />
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-700 group-hover:text-blue-900">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            {label}
          </span>
        </button>
        {failed && (
          <span className="max-w-40 text-xs text-red-600">
            Image could not be loaded from the upload server.
          </span>
        )}
      </div>

      {showModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}
        >
          <div className="relative max-w-3xl max-h-[90vh] w-full" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setShowModal(false)}
              className="absolute -top-10 right-0 text-white/80 hover:text-white text-sm font-medium"
            >
              Close ✕
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fullUrl}
              alt={label}
              className="w-full h-auto max-h-[85vh] object-contain rounded-xl shadow-2xl"
              onError={(e) => {
                const target = e.currentTarget
                target.style.display = 'none'
                const parent = target.parentElement
                if (parent) {
                  const errEl = document.createElement('div')
                  errEl.className = 'text-white text-center py-10'
                  errEl.textContent = '⚠️ Failed to load image. It may have been deleted or the server is unavailable.'
                  parent.appendChild(errEl)
                }
              }}
            />
          </div>
        </div>
      )}
    </>
  )
}
