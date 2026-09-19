import { betterAuth } from 'better-auth'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import type { getDb } from './db/client'
import {
  authAccount,
  authSession,
  authUser,
  authVerification,
} from './db/schema'
import { getEnv, getSiteUrl } from './env'
import { sendResetPasswordEmail } from './auth-email'

type Auth = ReturnType<typeof betterAuth>

let cachedAuth: Auth | undefined
let cachedDb: Awaited<ReturnType<typeof getDb>> | undefined

function trustedOrigins(): string[] {
  const siteUrl = getSiteUrl()
  const fromEnv = (getEnv('TRUSTED_ORIGINS') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  const dev = ['http://localhost:3000', 'http://127.0.0.1:3000']

  return [...new Set([siteUrl, ...fromEnv, ...dev])]
}

export async function getAuth(): Promise<Auth> {
  const { getDb } = await import('./db/client')
  const db = await getDb()

  if (cachedAuth && cachedDb === db) {
    return cachedAuth
  }

  const siteUrl = getSiteUrl()

  cachedDb = db
  cachedAuth = betterAuth({
    baseURL: siteUrl,
    secret: getEnv('BETTER_AUTH_SECRET') ?? 'dev-only-insecure-secret',
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema: {
        user: authUser,
        session: authSession,
        account: authAccount,
        verification: authVerification,
      },
    }),
    trustedOrigins: trustedOrigins(),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url, token }) => {
        await sendResetPasswordEmail({
          user: { email: user.email, name: user.name ?? null },
          url,
          token,
        })
      },
    },
  }) as unknown as Auth

  return cachedAuth
}

/** Best-effort current session; returns null outside a request context. */
export async function getSession() {
  const { getRequest } = await import('@tanstack/react-start/server')
  let headers: Headers
  try {
    headers = getRequest().headers
  } catch {
    return null
  }

  const auth = await getAuth()
  try {
    return await auth.api.getSession({ headers })
  } catch {
    return null
  }
}
