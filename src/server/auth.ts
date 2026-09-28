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
import { requestCache } from './request-cache'

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
    // Caches the session in a signed cookie so a page load does not spend a
    // database round trip just to find out who is signed in. D1 sits in a
    // different region from the Worker, so each query costs real latency.
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60,
      },
    },
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

/**
 * Current session, resolved once per request.
 *
 * Every guarded data function used to call this again, so a page touching
 * seven of them paid for seven session lookups, each a database query.
 * `requestCache` collapses them into one without leaking between callers.
 */
export async function getSession() {
  return await requestCache('__trytrackSession', async () => {
    const { getRequest } = await import('@tanstack/react-start/server')
    let request: Request
    try {
      request = getRequest()
    } catch {
      return null
    }

    const auth = await getAuth()
    try {
      return await auth.api.getSession({ headers: request.headers })
    } catch {
      return null
    }
  })
}
