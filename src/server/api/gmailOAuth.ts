import { eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { gmailConnections } from '../db/schema'
import { getEnv, getSiteUrl } from '../env'
import { newId } from '../db/ids'

/**
 * Gmail OAuth for the "Connect Gmail" button.
 *
 * The user authorizes read-only access once; we store the refresh token per
 * account so the scheduled sync can read new bank emails without any manual
 * terminal step.
 *
 * Google classifies `gmail.readonly` as a restricted scope. Apps used by a few
 * known people qualify for the "personal use" exception, so no Google
 * verification is needed until this is opened to the general public.
 */

export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
]

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo'

export function getGmailRedirectUri(): string {
  return `${getSiteUrl()}/api/email/gmail/callback`
}

export function isGmailConfigured(): boolean {
  return Boolean(getEnv('GMAIL_CLIENT_ID') && getEnv('GMAIL_CLIENT_SECRET'))
}

function requireClientCredentials() {
  const clientId = getEnv('GMAIL_CLIENT_ID')
  const clientSecret = getEnv('GMAIL_CLIENT_SECRET')

  if (!clientId || !clientSecret) {
    throw new Error(
      'GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET are not configured on the Worker.',
    )
  }

  return { clientId, clientSecret }
}

/**
 * Builds the Google consent URL. `state` is a random value the callback
 * verifies to prevent CSRF.
 */
export function buildGmailAuthUrl(state: string): string {
  const { clientId } = requireClientCredentials()
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getGmailRedirectUri(),
    response_type: 'code',
    scope: GMAIL_SCOPES.join(' '),
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    state,
  })

  return `${AUTHORIZE_URL}?${params.toString()}`
}

type TokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  error?: string
  error_description?: string
}

/** Exchanges the authorization code for tokens. */
export async function exchangeGmailCode(code: string): Promise<{
  refreshToken: string
  scope: string | null
}> {
  const { clientId, clientSecret } = requireClientCredentials()

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: getGmailRedirectUri(),
    }),
  })

  const body = (await response.json().catch(() => ({}))) as TokenResponse

  if (!response.ok || !body.refresh_token) {
    throw new Error(
      `Gmail authorization failed (${response.status}): ${
        body.error_description ?? body.error ?? 'no refresh token returned'
      }`,
    )
  }

  return { refreshToken: body.refresh_token, scope: body.scope ?? null }
}

/** Google account email behind an access token. */
export async function fetchGmailAccountEmail(
  accessToken: string,
): Promise<string | null> {
  const response = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    return null
  }

  const body = (await response.json().catch(() => ({}))) as {
    email?: string
  }
  return body.email?.toLowerCase() ?? null
}

/**
 * Exchanges a stored refresh token for an access token.
 * Throws `GmailReauthRequiredError` when Google rejects the grant, which means
 * the user must press "Connect Gmail" again.
 */
export class GmailReauthRequiredError extends Error {
  constructor(detail: string) {
    super(detail)
    this.name = 'GmailReauthRequiredError'
  }
}

export async function refreshGmailAccessToken(refreshToken: string): Promise<{
  accessToken: string
  expiresAt: number
}> {
  const { clientId, clientSecret } = requireClientCredentials()

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  const body = (await response.json().catch(() => ({}))) as TokenResponse & {
    error?: string
  }

  if (!response.ok || !body.access_token) {
    if (body.error === 'invalid_grant') {
      throw new GmailReauthRequiredError(
        'Gmail access expired or was revoked. Connect Gmail again.',
      )
    }
    throw new Error(
      `Gmail token refresh failed (${response.status}): ${
        body.error_description ?? body.error ?? 'unknown error'
      }`,
    )
  }

  return {
    accessToken: body.access_token,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
  }
}

/* ------------------------------------------------------------------ */
/* Stored connections                                                 */
/* ------------------------------------------------------------------ */

export async function upsertGmailConnection(input: {
  userId: string
  email: string
  refreshToken: string
  scope: string | null
}) {
  const db = await getDb()
  const now = Date.now()
  const email = input.email.toLowerCase()

  const [existing] = await db
    .select()
    .from(gmailConnections)
    .where(eq(gmailConnections.userId, input.userId))
    .limit(1)

  if (existing) {
    await db
      .update(gmailConnections)
      .set({
        email,
        refreshToken: input.refreshToken,
        scope: input.scope,
        // Reconnecting clears a previous failure.
        lastError: null,
        updatedAt: now,
      })
      .where(eq(gmailConnections.id, existing.id))
    return existing.id
  }

  const id = newId()
  await db.insert(gmailConnections).values({
    id,
    userId: input.userId,
    email,
    refreshToken: input.refreshToken,
    scope: input.scope,
    connectedAt: now,
    lastSyncedAt: null,
    lastError: null,
    updatedAt: now,
  })
  return id
}

export async function getGmailConnection(userId: string) {
  const db = await getDb()
  const [row] = await db
    .select()
    .from(gmailConnections)
    .where(eq(gmailConnections.userId, userId))
    .limit(1)
  return row ?? null
}

export async function getGmailConnectionByEmail(email: string) {
  const db = await getDb()
  const [row] = await db
    .select()
    .from(gmailConnections)
    .where(eq(gmailConnections.email, email.toLowerCase()))
    .limit(1)
  return row ?? null
}

export async function listGmailConnections() {
  const db = await getDb()
  return await db.select().from(gmailConnections)
}

export async function markGmailConnectionSynced(
  userId: string,
  syncedAt: number,
) {
  const db = await getDb()
  await db
    .update(gmailConnections)
    .set({ lastSyncedAt: syncedAt, lastError: null, updatedAt: syncedAt })
    .where(eq(gmailConnections.userId, userId))
}

export async function markGmailConnectionError(userId: string, error: string) {
  const db = await getDb()
  await db
    .update(gmailConnections)
    .set({ lastError: error.slice(0, 500), updatedAt: Date.now() })
    .where(eq(gmailConnections.userId, userId))
}

export async function disconnectGmail(userId: string) {
  const db = await getDb()
  await db.delete(gmailConnections).where(eq(gmailConnections.userId, userId))
}
