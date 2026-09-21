import { and, eq, inArray } from 'drizzle-orm'
import { getDb } from '../db/client'
import {
  debts,
  emailExpenseImports,
  expenses,
  recurringPayments,
  users,
} from '../db/schema'
import { getSession } from '../auth'

/**
 * Authorization helpers shared by the data functions.
 *
 * Every function that reads or writes user-owned rows must call one of these
 * before touching the database. The RPC dispatcher is reachable by any
 * signed-in account, so a `userId` argument can never be trusted on its own.
 */

export type AppUser = {
  id: string
  email: string
  name: string | null
  currency: string | null
  createdAt: number
  updatedAt: number
}

export class UnauthenticatedError extends Error {
  constructor() {
    super('Unauthenticated')
    this.name = 'UnauthenticatedError'
  }
}

export class ForbiddenError extends Error {
  constructor() {
    super('Unauthorized')
    this.name = 'ForbiddenError'
  }
}

/** Session email, or null when there is no valid session. */
export async function getSessionEmail(): Promise<string | null> {
  const session = await getSession()
  return session?.user?.email ?? null
}

/**
 * Resolve the app user row for the current session.
 * Throws `UnauthenticatedError` when there is no session.
 */
export async function requireAppUser(): Promise<AppUser> {
  const email = await getSessionEmail()
  if (!email) {
    throw new UnauthenticatedError()
  }

  const db = await getDb()
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  if (!row) {
    // Session exists but the app profile has not been created yet. This can
    // happen on the very first request after sign-up; callers that need a row
    // should use `ensureCurrent` first.
    throw new ForbiddenError()
  }

  return row
}

/**
 * Assert the given `userId` belongs to the signed-in account.
 * Returns the resolved app user so callers avoid a second lookup.
 */
export async function requireOwnUserId(userId: string): Promise<AppUser> {
  const appUser = await requireAppUser()

  if (appUser.id !== userId) {
    throw new ForbiddenError()
  }

  return appUser
}

/**
 * Assert the signed-in account owns a row in a user-owned table.
 * Used by mutations that only receive a record id (no userId).
 */
export async function requireOwnRecord(
  table: 'recurringPayments' | 'expenses' | 'emailExpenseImports',
  id: string,
) {
  const appUser = await requireAppUser()
  const db = await getDb()

  if (table === 'recurringPayments') {
    const [row] = await db
      .select({ id: recurringPayments.id })
      .from(recurringPayments)
      .where(
        and(
          eq(recurringPayments.id, id),
          eq(recurringPayments.userId, appUser.id),
        ),
      )
      .limit(1)

    if (!row) {
      throw new Error('Recurring payment not found')
    }
    return appUser
  }

  if (table === 'expenses') {
    const [row] = await db
      .select({ id: expenses.id })
      .from(expenses)
      .where(and(eq(expenses.id, id), eq(expenses.userId, appUser.id)))
      .limit(1)

    if (!row) {
      throw new Error('Expense not found')
    }
    return appUser
  }

  if (table === 'emailExpenseImports') {
    const [row] = await db
      .select({ id: emailExpenseImports.id })
      .from(emailExpenseImports)
      .where(
        and(
          eq(emailExpenseImports.id, id),
          eq(emailExpenseImports.userId, appUser.id),
        ),
      )
      .limit(1)

    if (!row) {
      throw new Error('Email expense not found')
    }
    return appUser
  }

  throw new Error('Unsupported table')
}

/**
 * Assert the signed-in account owns every given debt id.
 * Used by overview queries that receive a list of debt ids.
 */
export async function requireOwnDebts(debtIds: string[]) {
  const appUser = await requireAppUser()
  if (!debtIds.length) {
    return appUser
  }

  const db = await getDb()
  const rows = await db
    .select({ id: debts.id })
    .from(debts)
    .where(and(inArray(debts.id, debtIds), eq(debts.userId, appUser.id)))

  if (rows.length !== new Set(debtIds).size) {
    // Do not reveal whether the ids exist or belong to another account.
    throw new Error('Debt not found')
  }

  return appUser
}

/**
 * Assert the signed-in account owns this debt. Returns the debt row.
 * Used to guard mutations that only receive a debt id.
 */
export async function requireOwnDebt(debtId: string) {
  const appUser = await requireAppUser()
  const db = await getDb()
  const [debt] = await db
    .select()
    .from(debts)
    .where(and(eq(debts.id, debtId), eq(debts.userId, appUser.id)))
    .limit(1)

  if (!debt) {
    // Same message whether it is missing or someone else's: do not leak which.
    throw new Error('Debt not found')
  }

  return debt
}
