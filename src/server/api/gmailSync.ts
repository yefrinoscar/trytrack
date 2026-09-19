import { eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { gmailSyncStates } from '../db/schema'
import { newId } from '../db/ids'

export async function getState(args: { userEmail: string }) {
  const db = await getDb()
  const userEmail = args.userEmail.toLowerCase()
  const [row] = await db
    .select()
    .from(gmailSyncStates)
    .where(eq(gmailSyncStates.userEmail, userEmail))
    .limit(1)
  return row ?? null
}

export async function upsertState(args: {
  userEmail: string
  historyId?: string
  watchExpiration?: number
}) {
  const db = await getDb()
  const userEmail = args.userEmail.toLowerCase()
  const now = Date.now()
  const [existing] = await db
    .select()
    .from(gmailSyncStates)
    .where(eq(gmailSyncStates.userEmail, userEmail))
    .limit(1)

  if (existing) {
    await db
      .update(gmailSyncStates)
      .set({
        ...(args.historyId ? { historyId: args.historyId } : {}),
        ...(args.watchExpiration
          ? { watchExpiration: args.watchExpiration }
          : {}),
        updatedAt: now,
      })
      .where(eq(gmailSyncStates.id, existing.id))
    return existing.id
  }

  const id = newId()
  await db.insert(gmailSyncStates).values({
    id,
    userEmail,
    historyId: args.historyId ?? null,
    watchExpiration: args.watchExpiration ?? null,
    createdAt: now,
    updatedAt: now,
  })
  return id
}
