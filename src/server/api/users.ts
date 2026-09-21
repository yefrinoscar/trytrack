import { eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { users } from '../db/schema'
import { toDoc } from '../db/serialize'
import { newId } from '../db/ids'
import { getSession } from '../auth'

async function requireSessionEmail() {
  const session = await getSession()
  const email = session?.user?.email
  if (!email) {
    throw new Error('Unauthenticated')
  }
  return email
}

async function findByEmail(email: string) {
  const db = await getDb()
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1)
  return row ?? null
}

/** Lookup used by server-side jobs (webhooks, cron) that run without a session. */
export async function findUserByEmail(email: string) {
  return await findByEmail(email.toLowerCase())
}

/**
 * Returns the app profile for the current session, creating it on first use.
 *
 * Sign-up only creates the Better Auth user, so a freshly registered account
 * has no `users` row until the dashboard loads. Callers that must work
 * regardless of render order (for example the Gmail OAuth start endpoint) use
 * this instead of `resolveSessionUser`.
 */
export async function ensureSessionUser() {
  const session = await getSession()
  const email = session?.user?.email
  if (!email) {
    return null
  }

  return await ensureCurrent({ currency: undefined })
}

export async function getByEmail(args: { email: string }) {
  const email = await requireSessionEmail()
  if (email !== args.email) {
    return null
  }
  const row = await findByEmail(args.email)
  return row ? toDoc(row) : null
}

export async function current() {
  const session = await getSession()
  const email = session?.user?.email
  if (!email) {
    return null
  }
  const row = await findByEmail(email)
  return row ? toDoc(row) : null
}

export async function ensureCurrent(args: { currency?: string }) {
  const session = await getSession()
  const email = session?.user?.email
  if (!email) {
    throw new Error('Unauthenticated')
  }

  const existing = await findByEmail(email)
  if (existing) {
    return toDoc(existing)
  }

  const db = await getDb()
  const now = Date.now()
  const name =
    typeof session?.user?.name === 'string' && session.user.name.length > 0
      ? session.user.name
      : null

  const [created] = await db
    .insert(users)
    .values({
      id: newId(),
      email,
      name,
      currency: args.currency ?? 'USD',
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  if (!created) {
    throw new Error('Failed to create user')
  }
  return toDoc(created)
}

export async function create(args: {
  email: string
  name?: string
  currency?: string
}) {
  const email = await requireSessionEmail()
  if (email !== args.email) {
    throw new Error('Unauthorized')
  }

  const existing = await findByEmail(args.email)
  if (existing) {
    return existing.id
  }

  const db = await getDb()
  const now = Date.now()
  const [created] = await db
    .insert(users)
    .values({
      id: newId(),
      email: args.email,
      name: args.name ?? null,
      currency: args.currency ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
  return created!.id
}

export async function update(args: {
  id: string
  name?: string
  currency?: string
}) {
  const email = await requireSessionEmail()
  const db = await getDb()
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.id, args.id))
    .limit(1)

  if (!row || row.email !== email) {
    throw new Error('Unauthorized')
  }

  await db
    .update(users)
    .set({
      ...(args.name !== undefined ? { name: args.name } : {}),
      ...(args.currency !== undefined ? { currency: args.currency } : {}),
      updatedAt: Date.now(),
    })
    .where(eq(users.id, args.id))
}

/** Resolve the app user row for the current session (server-side helpers). */
export async function resolveSessionUser() {
  const session = await getSession()
  const email = session?.user?.email
  if (!email) {
    return null
  }
  return await findByEmail(email)
}
