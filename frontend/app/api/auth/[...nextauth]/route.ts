import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import FacebookProvider from 'next-auth/providers/facebook'
import type { NextAuthOptions, Provider } from 'next-auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL?.trim()

if (!API_URL && process.env.NODE_ENV === 'production') {
  console.warn('NEXT_PUBLIC_API_URL is not configured; OAuth sign-in will be unavailable.')
}

const providers: Provider[] = []

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  )
}

if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
  providers.push(
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    })
  )
}

export const authOptions: NextAuthOptions = {
  providers,
  callbacks: {
    async signIn({ user, account }) {
      if (!API_URL) return false

      try {
        const res = await fetch(`${API_URL}/auth/oauth-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: account?.provider,
            providerAccountId: account?.providerAccountId,
            email: user.email,
            name: user.name,
            image: user.image,
          }),
        })
        const data = await res.json()
        if (!data.success) return false
        ;(user as any).backendToken = data.data.token
        ;(user as any).role = data.data.user.role
        return true
      } catch {
        return false
      }
    },
    async jwt({ token, user }) {
      if (user) {
        token.backendToken = (user as any).backendToken
        token.role = (user as any).role
      }
      return token
    },
    async session({ session, token }) {
      ;(session as any).backendToken = token.backendToken
      ;(session as any).role = token.role
      return session
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: { strategy: 'jwt' },
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
