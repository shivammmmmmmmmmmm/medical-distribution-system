import { API_BASE } from './api-config'

// Extract the base URL without /api suffix
function getBaseUrl(): string {
  return API_BASE.replace(/\/api\/?$/, '')
}

/**
 * Resolves a product/upload image URL.
 * If the URL is relative (starts with /uploads/), prepend the API base URL.
 * If it's already absolute, return as-is.
 */
export function getImageUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/uploads/')) {
    return `${getBaseUrl()}${url}`
  }
  return url
}
