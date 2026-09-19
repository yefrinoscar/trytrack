import { and, desc, eq, gte, inArray, lte } from 'drizzle-orm'
import { getDb } from '../db/client'
import { emailExpenseImports, expenses, users } from '../db/schema'
import { newId } from '../db/ids'
import { toDoc } from '../db/serialize'
import { resolveSessionUser } from './users'
import type { InferSelectModel } from 'drizzle-orm'

type EmailImportRow = InferSelectModel<typeof emailExpenseImports>
type ExpenseRow = InferSelectModel<typeof expenses>

type EmailExpenseImportInput = {
  userEmail: string
  source?: string | null
  merchant?: string | null
  amount?: number | null
  currency?: string | null
  spentAt?: string | null
  occurredAt?: string | null
}

function normalizeImportedMerchant(value: string | undefined | null) {
  return value
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^PLIN-/i, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toLowerCase()
}

function isInternalTransferMerchant(value: string | undefined | null) {
  const merchant = normalizeImportedMerchant(value)

  return Boolean(
    merchant &&
    (merchant.includes('yefrin o laura c') ||
      merchant.includes('yefrin oscar laura') ||
      merchant.includes('yefrin oscar laur') ||
      merchant.includes('yefrioscar')),
  )
}

function getEmailImportFingerprint(row: EmailExpenseImportInput) {
  if (!row.amount || !row.currency || !row.spentAt) {
    return null
  }

  return [
    row.userEmail.toLowerCase(),
    row.source ?? 'email',
    normalizeImportedMerchant(row.merchant) ?? '',
    row.currency,
    row.amount.toFixed(2),
    row.spentAt,
  ].join('|')
}

function getStrictEmailImportFingerprint(row: EmailExpenseImportInput) {
  const fingerprint = getEmailImportFingerprint(row)

  return fingerprint && row.occurredAt
    ? `${fingerprint}|${row.occurredAt}`
    : fingerprint
}

function fingerprintOfRow(row: EmailImportRow) {
  return getEmailImportFingerprint({
    userEmail: row.userEmail,
    source: row.source,
    merchant: row.merchant,
    amount: row.amount,
    currency: row.currency,
    spentAt: row.spentAt,
    occurredAt: row.occurredAt,
  })
}

async function requireImportForUser(id: string, statusGuard?: string) {
  const appUser = await resolveSessionUser()
  if (!appUser) {
    throw new Error('Unauthenticated')
  }

  const db = await getDb()
  const [row] = await db
    .select()
    .from(emailExpenseImports)
    .where(eq(emailExpenseImports.id, id))
    .limit(1)

  if (!row || (statusGuard && row.status !== statusGuard)) {
    throw new Error('Pending email expense not found')
  }

  if (row.status === 'dismissed' && !statusGuard) {
    throw new Error('Email expense not found')
  }

  if (!row.userId || row.userId !== appUser.id) {
    throw new Error('Unauthorized')
  }

  return row
}

export async function listByUser(args: { userId: string }) {
  const db = await getDb()
  const rows = await db
    .select()
    .from(expenses)
    .where(eq(expenses.userId, args.userId))
    .orderBy(desc(expenses.spentAt))
    .limit(100)
  return rows.map(toDoc)
}

export async function listByDateRange(args: {
  userId: string
  startDate: string
  endDate: string
}) {
  const db = await getDb()
  const rows = await db
    .select()
    .from(expenses)
    .where(
      and(
        eq(expenses.userId, args.userId),
        gte(expenses.spentAt, args.startDate),
        lte(expenses.spentAt, args.endDate),
      ),
    )
    .limit(250)
  return rows.map(toDoc)
}

export async function create(args: {
  userId: string
  amount: number
  currency: string
  description: string
  category: string
  merchant?: string
  spentAt: string
}) {
  const db = await getDb()
  const now = Date.now()
  const id = newId()
  await db.insert(expenses).values({
    id,
    userId: args.userId,
    amount: args.amount,
    currency: args.currency,
    description: args.description,
    category: args.category,
    merchant: args.merchant ?? null,
    spentAt: args.spentAt,
    createdAt: now,
    updatedAt: now,
  })
  return id
}

export async function update(args: {
  id: string
  amount?: number
  currency?: string
  description?: string
  category?: string
  merchant?: string
  spentAt?: string
}) {
  const db = await getDb()
  const { id, ...value } = args
  const updates: Partial<ExpenseRow> = { ...value, updatedAt: Date.now() }
  await db.update(expenses).set(updates).where(eq(expenses.id, id))
}

export async function remove(args: { id: string }) {
  const db = await getDb()
  await db.delete(expenses).where(eq(expenses.id, args.id))
}

export async function importFromEmail(args: {
  userEmail: string
  provider: string
  emailId: string
  messageId?: string
  from?: string
  to: string[]
  subject?: string
  textSnippet?: string
  htmlSnippet?: string
  merchant?: string
  amount?: number
  currency?: string
  spentAt?: string
  occurredAt?: string
  source?: string
  category?: string
  dedupeKey?: string
  error?: string
}) {
  const db = await getDb()

  const [existing] = await db
    .select()
    .from(emailExpenseImports)
    .where(eq(emailExpenseImports.emailId, args.emailId))
    .limit(1)
  if (existing) {
    return existing.id
  }

  if (args.messageId) {
    const [existingByMessageId] = await db
      .select()
      .from(emailExpenseImports)
      .where(eq(emailExpenseImports.messageId, args.messageId))
      .limit(1)
    if (existingByMessageId) {
      return existingByMessageId.id
    }
  }

  if (args.dedupeKey) {
    const [existingByDedupeKey] = await db
      .select()
      .from(emailExpenseImports)
      .where(eq(emailExpenseImports.dedupeKey, args.dedupeKey))
      .limit(1)
    if (existingByDedupeKey) {
      return existingByDedupeKey.id
    }
  }

  const importFingerprint = getEmailImportFingerprint(args)
  if (importFingerprint) {
    for (const status of [
      'pending',
      'needs_review',
      'confirmed',
      'dismissed',
    ] as const) {
      const existingImports = await db
        .select()
        .from(emailExpenseImports)
        .where(
          and(
            eq(emailExpenseImports.userEmail, args.userEmail),
            eq(emailExpenseImports.status, status),
          ),
        )
        .limit(250)

      const existingImport = existingImports.find(
        (row) => fingerprintOfRow(row) === importFingerprint,
      )
      if (existingImport) {
        return existingImport.id
      }
    }
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, args.userEmail))
    .limit(1)

  const hasParsedExpense =
    typeof args.amount === 'number' &&
    args.amount > 0 &&
    Boolean(args.currency) &&
    Boolean(args.spentAt)
  const now = Date.now()
  const id = newId()

  await db.insert(emailExpenseImports).values({
    id,
    userId: user?.id ?? null,
    userEmail: args.userEmail,
    provider: args.provider,
    emailId: args.emailId,
    messageId: args.messageId ?? null,
    from: args.from ?? null,
    to: args.to,
    subject: args.subject ?? null,
    textSnippet: args.textSnippet ?? null,
    htmlSnippet: args.htmlSnippet ?? null,
    merchant: args.merchant ?? null,
    amount: args.amount ?? null,
    currency: args.currency ?? null,
    spentAt: args.spentAt ?? null,
    occurredAt: args.occurredAt ?? null,
    source: args.source ?? null,
    category: args.category ?? null,
    dedupeKey: args.dedupeKey ?? null,
    status: user && hasParsedExpense ? 'pending' : 'needs_review',
    error: user
      ? (args.error ?? null)
      : `No TryTrack user found for ${args.userEmail}`,
    confirmedExpenseId: null,
    createdAt: now,
    updatedAt: now,
  })

  return id
}

export async function listPendingEmailImports() {
  const appUser = await resolveSessionUser()
  if (!appUser) {
    return []
  }

  const db = await getDb()
  const rows = (
    await Promise.all(
      (['pending', 'confirmed'] as const).map((status) =>
        db
          .select()
          .from(emailExpenseImports)
          .where(
            and(
              eq(emailExpenseImports.userId, appUser.id),
              eq(emailExpenseImports.status, status),
            ),
          )
          .orderBy(desc(emailExpenseImports.createdAt))
          .limit(250),
      ),
    )
  )
    .flat()
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, 250)

  const seen = new Set<string>()
  const uniqueRows: EmailImportRow[] = []

  for (const row of rows) {
    if (isInternalTransferMerchant(row.merchant)) {
      continue
    }

    const fingerprint = row.dedupeKey ?? fingerprintOfRow(row)
    if (fingerprint && seen.has(fingerprint)) {
      continue
    }
    if (fingerprint) {
      seen.add(fingerprint)
    }
    uniqueRows.push(row)
  }

  const confirmedIds = uniqueRows
    .map((row) => row.confirmedExpenseId)
    .filter((value): value is string => Boolean(value))
  const confirmedExpenses = confirmedIds.length
    ? await db.select().from(expenses).where(inArray(expenses.id, confirmedIds))
    : []
  const expensesById = new Map(
    confirmedExpenses.map((expense) => [expense.id, expense]),
  )

  return uniqueRows.map((row) => {
    const doc = toDoc(row)
    if (!row.confirmedExpenseId) {
      return doc
    }
    const expense = expensesById.get(row.confirmedExpenseId)
    return { ...doc, category: expense?.category ?? row.category }
  })
}

export async function updateEmailImportCategory(args: {
  id: string
  category: string
}) {
  const row = await requireImportForUser(args.id)

  const category = args.category.trim()
  if (!category) {
    throw new Error('Category is required')
  }

  const db = await getDb()
  const now = Date.now()
  await db
    .update(emailExpenseImports)
    .set({ category, updatedAt: now })
    .where(eq(emailExpenseImports.id, row.id))

  if (row.confirmedExpenseId) {
    await db
      .update(expenses)
      .set({ category, updatedAt: now })
      .where(eq(expenses.id, row.confirmedExpenseId))
  }
}

export async function confirmEmailImport(args: {
  id: string
  category?: string
}) {
  const row = await requireImportForUser(args.id, 'pending')

  if (!row.amount || !row.currency || !row.spentAt) {
    throw new Error('Email expense is missing parsed fields')
  }

  if (isInternalTransferMerchant(row.merchant)) {
    const db = await getDb()
    await db
      .update(emailExpenseImports)
      .set({ status: 'dismissed', updatedAt: Date.now() })
      .where(eq(emailExpenseImports.id, row.id))
    throw new Error('Internal transfer ignored')
  }

  const db = await getDb()
  const matchingExpenses = await db
    .select()
    .from(expenses)
    .where(
      and(eq(expenses.userId, row.userId!), eq(expenses.spentAt, row.spentAt)),
    )
    .limit(100)
  const existingExpense = matchingExpenses.find(
    (expense) =>
      expense.amount === row.amount &&
      expense.currency === row.currency &&
      normalizeImportedMerchant(expense.merchant ?? expense.description) ===
        normalizeImportedMerchant(row.merchant ?? row.subject),
  )
  const now = Date.now()

  if (existingExpense) {
    await db
      .update(emailExpenseImports)
      .set({
        status: 'confirmed',
        confirmedExpenseId: existingExpense.id,
        updatedAt: now,
      })
      .where(eq(emailExpenseImports.id, row.id))
    return existingExpense.id
  }

  const expenseId = newId()
  await db.insert(expenses).values({
    id: expenseId,
    userId: row.userId!,
    amount: row.amount,
    currency: row.currency,
    category: args.category?.trim() || 'Email import',
    description: row.merchant ?? row.subject ?? 'Email expense',
    merchant: row.merchant,
    spentAt: row.spentAt,
    createdAt: now,
    updatedAt: now,
  })

  const rowFingerprint = row.dedupeKey ?? fingerprintOfRow(row)
  if (rowFingerprint) {
    const siblingRows = await db
      .select()
      .from(emailExpenseImports)
      .where(
        and(
          eq(emailExpenseImports.userId, row.userId!),
          eq(emailExpenseImports.status, 'pending'),
        ),
      )
      .limit(250)

    for (const siblingRow of siblingRows) {
      if (
        siblingRow.id !== row.id &&
        (siblingRow.dedupeKey ?? fingerprintOfRow(siblingRow)) ===
          rowFingerprint
      ) {
        await db
          .update(emailExpenseImports)
          .set({ status: 'dismissed', updatedAt: now })
          .where(eq(emailExpenseImports.id, siblingRow.id))
      }
    }
  }

  await db
    .update(emailExpenseImports)
    .set({ status: 'confirmed', confirmedExpenseId: expenseId, updatedAt: now })
    .where(eq(emailExpenseImports.id, row.id))

  return expenseId
}

export async function dismissEmailImport(args: { id: string }) {
  const appUser = await resolveSessionUser()
  if (!appUser) {
    throw new Error('Unauthenticated')
  }

  const db = await getDb()
  const [row] = await db
    .select()
    .from(emailExpenseImports)
    .where(eq(emailExpenseImports.id, args.id))
    .limit(1)

  if (!row) {
    return
  }

  if (!row.userId || row.userId !== appUser.id) {
    throw new Error('Unauthorized')
  }

  await db
    .update(emailExpenseImports)
    .set({ status: 'dismissed', updatedAt: Date.now() })
    .where(eq(emailExpenseImports.id, row.id))
}

/* ------------------------------------------------------------------ */
/* Internal maintenance helpers (used by scripts / scheduled tasks)   */
/* ------------------------------------------------------------------ */

export async function dismissPendingEmailImportsOutsideSpentAtRange(args: {
  start: string
  end: string
}) {
  const db = await getDb()
  const rows = await db.select().from(emailExpenseImports).limit(500)
  const now = Date.now()
  let dismissed = 0

  for (const row of rows) {
    if (!row.spentAt || row.spentAt < args.start || row.spentAt >= args.end) {
      await db
        .update(emailExpenseImports)
        .set({ status: 'dismissed', updatedAt: now })
        .where(eq(emailExpenseImports.id, row.id))
      dismissed += 1
    }
  }

  return { dismissed }
}

export async function dismissInternalTransferAndDuplicateEmailImports() {
  const db = await getDb()
  const rows = await db.select().from(emailExpenseImports).limit(1000)
  const now = Date.now()
  const seen = new Set<string>()
  let dismissedInternal = 0
  let dismissedDuplicates = 0

  for (const row of rows) {
    if (row.status !== 'pending') {
      continue
    }

    if (isInternalTransferMerchant(row.merchant)) {
      await db
        .update(emailExpenseImports)
        .set({ status: 'dismissed', updatedAt: now })
        .where(eq(emailExpenseImports.id, row.id))
      dismissedInternal += 1
      continue
    }

    if (!row.amount || !row.currency || !row.spentAt) {
      continue
    }

    const key = row.dedupeKey ?? fingerprintOfRow(row)
    if (!key) {
      continue
    }

    if (seen.has(key)) {
      await db
        .update(emailExpenseImports)
        .set({ status: 'dismissed', updatedAt: now })
        .where(eq(emailExpenseImports.id, row.id))
      dismissedDuplicates += 1
      continue
    }

    seen.add(key)
  }

  return { dismissedDuplicates, dismissedInternal }
}

export async function deleteDuplicateEmailImports() {
  const db = await getDb()
  const rows = await db.select().from(emailExpenseImports).limit(1000)
  const byFingerprint = new Map<string, EmailImportRow[]>()
  let deleted = 0

  for (const row of rows) {
    const fingerprint = getStrictEmailImportFingerprint({
      userEmail: row.userEmail,
      source: row.source,
      merchant: row.merchant,
      amount: row.amount,
      currency: row.currency,
      spentAt: row.spentAt,
      occurredAt: row.occurredAt,
    })
    if (!fingerprint) {
      continue
    }
    byFingerprint.set(fingerprint, [
      ...(byFingerprint.get(fingerprint) ?? []),
      row,
    ])
  }

  const statusRank = {
    confirmed: 0,
    pending: 1,
    needs_review: 2,
    dismissed: 3,
  } as const

  for (const duplicateRows of byFingerprint.values()) {
    if (duplicateRows.length < 2) {
      continue
    }

    const [keeper, ...duplicates] = duplicateRows
      .slice()
      .sort(
        (left, right) =>
          statusRank[left.status as keyof typeof statusRank] -
            statusRank[right.status as keyof typeof statusRank] ||
          right.updatedAt - left.updatedAt,
      )

    for (const duplicate of duplicates) {
      if (duplicate.id === keeper?.id) {
        continue
      }
      await db
        .delete(emailExpenseImports)
        .where(eq(emailExpenseImports.id, duplicate.id))
      deleted += 1
    }
  }

  return { deleted }
}
