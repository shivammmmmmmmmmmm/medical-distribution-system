const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim()

export const API_BASE = configuredApiUrl || (
  process.env.NODE_ENV === 'development' ? 'http://localhost:3001/api' : ''
)

export const UPLOAD_BASE = API_BASE.replace(/\/api\/?$/, '')

export function getApiConfigurationError(): Error {
  return new Error(
    process.env.NODE_ENV === 'development'
      ? 'The backend API URL is not configured.'
      : 'Unable to connect to the server. Please try again.'
  )
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }
  return fallback
}
