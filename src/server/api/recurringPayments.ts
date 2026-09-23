import { and, asc, eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { recurringPayments } from '../db/schema'
import { newId } from '../db/ids'
import { toDoc } from '../db/serialize'
import { requireOwnRecord, requireOwnUserId } from './authz'
import type { InferSelectModel } from 'drizzle-orm'

type RecurringStatus = 'active' | 'paused' | 'cancelled'
type RecurringRow = InferSelectModel<typeof recurringPayments>

export async function listByUser(args: { userId: string }) {
  await requireOwnUserId(args.userId)

  const db = await getDb()
  const rows = await db
    .select()
    .from(recurringPayments)
    .where(eq(recurringPayments.userId, args.userId))
    .orderBy(asc(recurringPayments.dueDay))
    .limit(100)
  return rows.map(toDoc)
}

export async function create(args: {
  userId: string
  name: string
  category: string
  currency: string
  amount: number
  dueDay: number
  startDate: string
  endDate?: string
  status?: RecurringStatus
}) {
  await requireOwnUserId(args.userId)

  const db = await getDb()
  const now = Date.now()
  const id = newId()
  await db.insert(recurringPayments).values({
    id,
    userId: args.userId,
    name: args.name,
    category: args.category,
    currency: args.currency,
    amount: args.amount,
    cadence: 'monthly',
    dueDay: args.dueDay,
    startDate: args.startDate,
    endDate: args.endDate ?? null,
    status: args.status ?? 'active',
    createdAt: now,
    updatedAt: now,
  })
  return id
}

export async function update(args: {
  id: string
  name?: string
  category?: string
  currency?: string
  amount?: number
  dueDay?: number
  startDate?: string
  endDate?: string
  status?: RecurringStatus
}) {
  await requireOwnRecord('recurringPayments', args.id)

  const db = await getDb()
  const { id, ...value } = args
  const updates: Partial<RecurringRow> = {
    ...value,
    updatedAt: Date.now(),
  }
  await db
    .update(recurringPayments)
    .set(updates)
    .where(eq(recurringPayments.id, id))
}

export async function remove(args: { id: string }) {
  await requireOwnRecord('recurringPayments', args.id)

  const db = await getDb()
  await db.delete(recurringPayments).where(eq(recurringPayments.id, args.id))
}

/* ------------------------------------------------------------------ */
/* Session-less helpers used by the public API                         */
/* ------------------------------------------------------------------ */

/** Creates a recurring payment without a browser session. */
export async function createForApi(args: {
  userId: string
  name: string
  category: string
  currency: string
  amount: number
  dueDay: number
  startDate: string
  endDate?: string
  status?: RecurringStatus
}) {
  const db = await getDb()
  const now = Date.now()
  const id = newId()

  await db.insert(recurringPayments).values({
    id,
    userId: args.userId,
    name: args.name,
    category: args.category,
    currency: args.currency,
    amount: args.amount,
    cadence: 'monthly',
    dueDay: args.dueDay,
    startDate: args.startDate,
    endDate: args.endDate ?? null,
    status: args.status ?? 'active',
    createdAt: now,
    updatedAt: now,
  })

  return id
}

/** Deletes one recurring payment by id. Returns false when it does not exist. */
export async function removeByIdForApi(id: string) {
  const db = await getDb()
  const [row] = await db
    .select({ id: recurringPayments.id })
    .from(recurringPayments)
    .where(eq(recurringPayments.id, id))
    .limit(1)

  if (!row) {
    return false
  }

  await db.delete(recurringPayments).where(eq(recurringPayments.id, id))
  return true
}

/**
 * Deletes every recurring payment of one account that matches the filters.
 * At least one filter is required so a mistake cannot wipe the table.
 */
export async function removeMatchingForApi(args: {
  userId: string
  name?: string
  category?: string
  currency?: string
  status?: string
}) {
  const filters = [
    args.name ? eq(recurringPayments.name, args.name) : null,
    args.category ? eq(recurringPayments.category, args.category) : null,
    args.currency
      ? eq(recurringPayments.currency, args.currency.toUpperCase())
      : null,
    args.status ? eq(recurringPayments.status, args.status) : null,
  ].filter((condition): condition is NonNullable<typeof condition> =>
    Boolean(condition),
  )

  if (!filters.length) {
    throw new Error('At least one filter is required.')
  }

  const where = and(eq(recurringPayments.userId, args.userId), ...filters)
  const db = await getDb()
  const rows = await db
    .select({ id: recurringPayments.id })
    .from(recurringPayments)
    .where(where)

  if (!rows.length) {
    return 0
  }

  await db.delete(recurringPayments).where(where)
  return rows.length
}
