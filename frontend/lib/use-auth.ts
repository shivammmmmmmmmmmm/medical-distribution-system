'use client'

import { useEffect, useState } from 'react'
import { authClient } from './auth-client'
import { User } from './types'
import { getErrorMessage } from './api-config'

let cachedUser: User | null = null
let cachedLoaded = false
let inFlight: Promise<User | null> | null = null

export function invalidateAuthCache() {
  cachedUser = null
  cachedLoaded = false
  inFlight = null
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(cachedLoaded ? cachedUser : null)
  const [loading, setLoading] = useState(!cachedLoaded)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (cachedLoaded) {
      setUser(cachedUser)
      setLoading(false)
      return
    }

    const fetchUser = async () => {
      try {
        if (!authClient.isAuthenticated()) {
          cachedUser = null
          cachedLoaded = true
          return
        }

        // Deduplicate concurrent /auth/me calls across page navigations.
        if (!inFlight) {
          inFlight = authClient
            .getCurrentUser()
            .then(u => {
              cachedUser = u
              cachedLoaded = true
              return u
            })
            .catch(err => {
              cachedUser = null
              cachedLoaded = true
              throw err
            })
            .finally(() => {
              inFlight = null
            })
        }

        const u = await inFlight
        setUser(u)
      } catch (err) {
        console.error('Failed to fetch authenticated user', err)
        setError(getErrorMessage(err, 'Unable to connect to the server. Please try again.'))
        authClient.logout()
      } finally {
        setLoading(false)
      }
    }

    fetchUser()
  }, [])

  return {
    user,
    loading,
    error,
    isAuthenticated: !!user,
  }
}

