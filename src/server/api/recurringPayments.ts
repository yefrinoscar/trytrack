import { asc, eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { recurringPayments } from '../db/schema'
import { newId } from '../db/ids'
import { toDoc } from '../db/serialize'
import type { InferSelectModel } from 'drizzle-orm'

type RecurringStatus = 'active' | 'paused' | 'cancelled'
type RecurringRow = InferSelectModel<typeof recurringPayments>

export async function listByUser(args: { userId: string }) {
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
  const db = await getDb()
  await db.delete(recurringPayments).where(eq(recurringPayments.id, args.id))
}
