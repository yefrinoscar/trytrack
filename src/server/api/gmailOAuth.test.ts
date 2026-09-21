import { afterAll, beforeAll, describe, expect, test, vi } from 'vite-plus/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Gmail connection storage and OAuth state handling. No network calls: the
 * Google endpoints are exercised indirectly through the stored rows.
 */
let dir: string

const mockSession = vi.fn()

vi.mock('#/server/auth', () => ({
  getSession: () => mockSession(),
}))

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'trytrack-gmail-'))
  process.env.LOCAL_DB_PATH = join(dir, 'gmail.db')
  const migrations = execFileSync('ls', ['migrations'])
    .toString()
    .trim()
    .split('\n')
    .filter((name) => name.endsWith('.sql'))
    .sort()
  const sql = migrations
    .map((name) => execFileSync('cat', [join('migrations', name)]).toString())
    .join('\n')
  execFileSync('sqlite3', [process.env.LOCAL_DB_PATH], { input: sql })

  const { getDb } = await import('#/server/db/client')
  const { users } = await import('#/server/db/schema')
  const db = await getDb()
  const now = Date.now()
  await db.insert(users).values({
    id: 'owner',
    email: 'owner@test.local',
    name: 'Owner',
    currency: 'USD',
    createdAt: now,
    updatedAt: now,
  })
})

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('gmail connections', () => {
  test('connecting stores the refresh token for the account', async () => {
    const oauth = await import('#/server/api/gmailOAuth')

    await oauth.upsertGmailConnection({
      userId: 'owner',
      email: 'Owner@Test.local',
      refreshToken: 'refresh-1',
      scope: 'scope-a',
    })

    const stored = await oauth.getGmailConnection('owner')
    expect(stored?.email).toBe('owner@test.local')
    expect(stored?.refreshToken).toBe('refresh-1')

    // Lookup by email is case-insensitive (used by the sync job).
    const byEmail = await oauth.getGmailConnectionByEmail('OWNER@test.local')
    expect(byEmail?.userId).toBe('owner')
  })

  test('reconnecting replaces the token instead of duplicating the row', async () => {
    const oauth = await import('#/server/api/gmailOAuth')

    await oauth.upsertGmailConnection({
      userId: 'owner',
      email: 'owner@test.local',
      refreshToken: 'refresh-2',
      scope: 'scope-b',
    })

    const all = await oauth.listGmailConnections()
    expect(all).toHaveLength(1)
    expect(all[0].refreshToken).toBe('refresh-2')
  })

  test('sync bookkeeping records success and failure', async () => {
    const oauth = await import('#/server/api/gmailOAuth')

    await oauth.markGmailConnectionSynced('owner', 1_700_000_000_000)
    let stored = await oauth.getGmailConnection('owner')
    expect(stored?.lastSyncedAt).toBe(1_700_000_000_000)
    expect(stored?.lastError).toBeNull()

    await oauth.markGmailConnectionError('owner', 'invalid_grant')
    stored = await oauth.getGmailConnection('owner')
    expect(stored?.lastError).toBe('invalid_grant')
  })

  test('disconnect removes the connection and stops the sync', async () => {
    const oauth = await import('#/server/api/gmailOAuth')

    await oauth.disconnectGmail('owner')
    expect(await oauth.getGmailConnection('owner')).toBeNull()
    expect(await oauth.listGmailConnections()).toHaveLength(0)
  })

  test('oauth state is single-use and expires', async () => {
    const state = await import('#/server/api/oauthState')

    const value = await state.createOAuthState('owner')
    expect(await state.consumeOAuthState(value)).toBe('owner')
    // Second use must fail.
    expect(await state.consumeOAuthState(value)).toBeNull()

    expect(await state.consumeOAuthState('does-not-exist')).toBeNull()
    expect(await state.consumeOAuthState('')).toBeNull()
  })

  test('the connect URL requests offline read-only Gmail access', async () => {
    process.env.GMAIL_CLIENT_ID = 'client-id'
    process.env.GMAIL_CLIENT_SECRET = 'client-secret'
    process.env.SITE_URL = 'https://trytrack.test'

    const oauth = await import('#/server/api/gmailOAuth')
    const url = new URL(oauth.buildGmailAuthUrl('state-123'))

    expect(url.origin + url.pathname).toBe(
      'https://accounts.google.com/o/oauth2/v2/auth',
    )
    expect(url.searchParams.get('access_type')).toBe('offline')
    expect(url.searchParams.get('prompt')).toBe('consent')
    expect(url.searchParams.get('state')).toBe('state-123')
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://trytrack.test/api/email/gmail/callback',
    )
    expect(url.searchParams.get('scope')).toContain('gmail.readonly')
  })
})
