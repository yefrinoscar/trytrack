import { and, eq, gt } from 'drizzle-orm'
import { getDb } from '../db/client'
import { authVerification } from '../db/schema'
import { newId } from '../db/ids'

/**
 * Short-lived, single-use state values for the Gmail OAuth round trip.
 *
 * Reuses Better Auth's `verification` table so no extra table is needed. The
 * row holds the app user id that started the flow; the callback only accepts it
 * once and only for the same signed-in account.
 */

const TTL_MS = 10 * 60 * 1000
const PREFIX = 'gmail-oauth:'

export async function createOAuthState(userId: string): Promise<string> {
  const db = await getDb()
  const state = crypto.randomUUID()
  const now = Date.now()

  await db.insert(authVerification).values({
    id: newId(),
    identifier: `${PREFIX}${state}`,
    value: userId,
    expiresAt: new Date(now + TTL_MS),
    createdAt: new Date(now),
    updatedAt: new Date(now),
  })

  return state
}

/**
 * Validates and consumes a state value. Returns the user id it was issued to,
 * or null when the state is unknown, expired or already used.
 */
export async function consumeOAuthState(state: string): Promise<string | null> {
  if (!state) {
    return null
  }

  const db = await getDb()
  const identifier = `${PREFIX}${state}`
  const [row] = await db
    .select()
    .from(authVerification)
    .where(
      and(
        eq(authVerification.identifier, identifier),
        gt(authVerification.expiresAt, new Date()),
      ),
    )
    .limit(1)

  if (!row) {
    return null
  }

  await db.delete(authVerification).where(eq(authVerification.id, row.id))

  return row.value
}
