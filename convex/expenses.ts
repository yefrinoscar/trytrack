import { query, mutation, internalMutation } from './_generated/server'
import { ConvexError } from 'convex/values'
import { v } from 'convex/values'
import { authComponent } from './auth'

type EmailExpenseImportRow = {
  userEmail: string
  source?: string
  merchant?: string
  amount?: number
  currency?: string
  spentAt?: string
}

function normalizeImportedMerchant(value: string | undefined) {
  return value
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^PLIN-/i, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toLowerCase()
}

function isInternalTransferMerchant(value: string | undefined) {
  const merchant = normalizeImportedMerchant(value)

  return Boolean(
    merchant &&
    (merchant.includes('yefrin o laura c') ||
      merchant.includes('yefrin oscar laura') ||
      merchant.includes('yefrin oscar laur') ||
      merchant.includes('yefrioscar')),
  )
}

function getEmailImportFingerprint(row: EmailExpenseImportRow) {
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

function getStrictEmailImportFingerprint(
  row: EmailExpenseImportRow & { occurredAt?: string },
) {
  const fingerprint = getEmailImportFingerprint(row)

  return fingerprint && row.occurredAt
    ? `${fingerprint}|${row.occurredAt}`
    : fingerprint
}

export const listByUser = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('expenses')
      .withIndex('by_userId_and_spentAt', (q) => q.eq('userId', args.userId))
      .order('desc')
      .take(100)
  },
})

export const listByDateRange = query({
  args: {
    userId: v.id('users'),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('expenses')
      .withIndex('by_userId_and_spentAt', (q) =>
        q
          .eq('userId', args.userId)
          .gte('spentAt', args.startDate)
          .lte('spentAt', args.endDate),
      )
      .take(250)
  },
})

export const create = mutation({
  args: {
    userId: v.id('users'),
    amount: v.number(),
    currency: v.string(),
    description: v.string(),
    category: v.string(),
    merchant: v.optional(v.string()),
    spentAt: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const expenseId = await ctx.db.insert('expenses', {
      ...args,
      createdAt: now,
      updatedAt: now,
    })
    return expenseId
  },
})

export const update = mutation({
  args: {
    id: v.id('expenses'),
    amount: v.optional(v.number()),
    currency: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    merchant: v.optional(v.string()),
    spentAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...value } = args
    await ctx.db.patch(id, {
      ...value,
      updatedAt: Date.now(),
    })
  },
})

export const remove = mutation({
  args: { id: v.id('expenses') },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
  },
})

export const importFromEmail = mutation({
  args: {
    userEmail: v.string(),
    provider: v.string(),
    emailId: v.string(),
    messageId: v.optional(v.string()),
    from: v.optional(v.string()),
    to: v.array(v.string()),
    subject: v.optional(v.string()),
    textSnippet: v.optional(v.string()),
    htmlSnippet: v.optional(v.string()),
    merchant: v.optional(v.string()),
    amount: v.optional(v.number()),
    currency: v.optional(v.string()),
    spentAt: v.optional(v.string()),
    occurredAt: v.optional(v.string()),
    source: v.optional(v.string()),
    dedupeKey: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('emailExpenseImports')
      .withIndex('by_emailId', (q) => q.eq('emailId', args.emailId))
      .first()

    if (existing) {
      return existing._id
    }

    if (args.messageId) {
      const existingByMessageId = await ctx.db
        .query('emailExpenseImports')
        .withIndex('by_messageId', (q) => q.eq('messageId', args.messageId))
        .first()

      if (existingByMessageId) {
        return existingByMessageId._id
      }
    }

    if (args.dedupeKey) {
      const existingByDedupeKey = await ctx.db
        .query('emailExpenseImports')
        .withIndex('by_dedupeKey', (q) => q.eq('dedupeKey', args.dedupeKey))
        .first()

      if (existingByDedupeKey) {
        return existingByDedupeKey._id
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
        const existingImports = await ctx.db
          .query('emailExpenseImports')
          .withIndex('by_userEmail_and_status', (q) =>
            q.eq('userEmail', args.userEmail).eq('status', status),
          )
          .take(250)

        const existingImport = existingImports.find(
          (row) => getEmailImportFingerprint(row) === importFingerprint,
        )

        if (existingImport) {
          return existingImport._id
        }
      }
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', args.userEmail))
      .unique()
    const hasParsedExpense =
      typeof args.amount === 'number' &&
      args.amount > 0 &&
      Boolean(args.currency) &&
      Boolean(args.spentAt)
    const now = Date.now()

    return await ctx.db.insert('emailExpenseImports', {
      userId: user?._id,
      userEmail: args.userEmail,
      provider: args.provider,
      emailId: args.emailId,
      messageId: args.messageId,
      from: args.from,
      to: args.to,
      subject: args.subject,
      textSnippet: args.textSnippet,
      htmlSnippet: args.htmlSnippet,
      merchant: args.merchant,
      amount: args.amount,
      currency: args.currency,
      spentAt: args.spentAt,
      occurredAt: args.occurredAt,
      source: args.source,
      dedupeKey: args.dedupeKey,
      status: user && hasParsedExpense ? 'pending' : 'needs_review',
      error: user ? args.error : `No TryTrack user found for ${args.userEmail}`,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const listPendingEmailImports = query({
  args: {},
  handler: async (ctx) => {
    const authUser = await authComponent.safeGetAuthUser(ctx)
    if (!authUser?.email) {
      return []
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', authUser.email))
      .unique()

    if (!user) {
      return []
    }

    const rows = (
      await Promise.all(
        (['pending', 'confirmed'] as const).map((status) =>
          ctx.db
            .query('emailExpenseImports')
            .withIndex('by_userId_and_status', (q) =>
              q.eq('userId', user._id).eq('status', status),
            )
            .order('desc')
            .take(250),
        ),
      )
    )
      .flat()
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, 250)

    const seen = new Set<string>()
    const uniqueRows = []

    for (const row of rows) {
      if (isInternalTransferMerchant(row.merchant)) {
        continue
      }

      const fingerprint = row.dedupeKey ?? getEmailImportFingerprint(row)
      if (fingerprint && seen.has(fingerprint)) {
        continue
      }

      if (fingerprint) {
        seen.add(fingerprint)
      }

      uniqueRows.push(row)
    }

    return await Promise.all(
      uniqueRows.map(async (row) => {
        if (!row.confirmedExpenseId) {
          return row
        }

        const expense = await ctx.db.get(row.confirmedExpenseId)

        return {
          ...row,
          category: expense?.category,
        }
      }),
    )
  },
})

export const dismissPendingEmailImportsOutsideSpentAtRange = internalMutation({
  args: {
    start: v.string(),
    end: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query('emailExpenseImports').take(500)
    const now = Date.now()
    let dismissed = 0

    for (const row of rows) {
      if (!row.spentAt || row.spentAt < args.start || row.spentAt >= args.end) {
        await ctx.db.patch(row._id, {
          status: 'dismissed',
          updatedAt: now,
        })
        dismissed += 1
      }
    }

    return { dismissed }
  },
})

export const dismissInternalTransferAndDuplicateEmailImports = internalMutation(
  {
    args: {},
    handler: async (ctx) => {
      const rows = await ctx.db.query('emailExpenseImports').take(1000)
      const now = Date.now()
      const seen = new Set<string>()
      let dismissedInternal = 0
      let dismissedDuplicates = 0

      for (const row of rows) {
        if (row.status !== 'pending') {
          continue
        }

        if (isInternalTransferMerchant(row.merchant)) {
          await ctx.db.patch(row._id, {
            status: 'dismissed',
            updatedAt: now,
          })
          dismissedInternal += 1
          continue
        }

        if (!row.amount || !row.currency || !row.spentAt) {
          continue
        }

        const key = row.dedupeKey ?? getEmailImportFingerprint(row)

        if (!key) {
          continue
        }

        if (seen.has(key)) {
          await ctx.db.patch(row._id, {
            status: 'dismissed',
            updatedAt: now,
          })
          dismissedDuplicates += 1
          continue
        }

        seen.add(key)
      }

      return { dismissedDuplicates, dismissedInternal }
    },
  },
)

export const deleteDuplicateEmailImports = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query('emailExpenseImports').take(1000)
    const byFingerprint = new Map<string, typeof rows>()
    let deleted = 0

    for (const row of rows) {
      const fingerprint = getStrictEmailImportFingerprint(row)

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
            statusRank[left.status] - statusRank[right.status] ||
            right.updatedAt - left.updatedAt,
        )

      for (const duplicate of duplicates) {
        if (duplicate._id === keeper?._id) {
          continue
        }

        await ctx.db.delete(duplicate._id)
        deleted += 1
      }
    }

    return { deleted }
  },
})

export const confirmEmailImport = mutation({
  args: {
    id: v.id('emailExpenseImports'),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx)
    if (!authUser?.email) {
      throw new ConvexError('Unauthenticated')
    }

    const row = await ctx.db.get(args.id)
    if (!row || row.status !== 'pending') {
      throw new ConvexError('Pending email expense not found')
    }

    const user = row.userId ? await ctx.db.get(row.userId) : null
    if (!user || user.email !== authUser.email) {
      throw new ConvexError('Unauthorized')
    }

    if (!row.amount || !row.currency || !row.spentAt) {
      throw new ConvexError('Email expense is missing parsed fields')
    }

    if (isInternalTransferMerchant(row.merchant)) {
      await ctx.db.patch(row._id, {
        status: 'dismissed',
        updatedAt: Date.now(),
      })
      throw new ConvexError('Internal transfer ignored')
    }

    const matchingExpenses = await ctx.db
      .query('expenses')
      .withIndex('by_userId_and_spentAt', (q) =>
        q.eq('userId', user._id).eq('spentAt', row.spentAt!),
      )
      .take(100)
    const existingExpense = matchingExpenses.find(
      (expense) =>
        expense.amount === row.amount &&
        expense.currency === row.currency &&
        normalizeImportedMerchant(expense.merchant ?? expense.description) ===
          normalizeImportedMerchant(row.merchant ?? row.subject),
    )
    const now = Date.now()

    if (existingExpense) {
      await ctx.db.patch(row._id, {
        status: 'confirmed',
        confirmedExpenseId: existingExpense._id,
        updatedAt: now,
      })
      return existingExpense._id
    }

    const expenseId = await ctx.db.insert('expenses', {
      userId: user._id,
      amount: row.amount,
      currency: row.currency,
      category: args.category?.trim() || 'Email import',
      description: row.merchant ?? row.subject ?? 'Email expense',
      merchant: row.merchant,
      spentAt: row.spentAt,
      createdAt: now,
      updatedAt: now,
    })

    const rowFingerprint = row.dedupeKey ?? getEmailImportFingerprint(row)
    if (rowFingerprint) {
      const siblingRows = await ctx.db
        .query('emailExpenseImports')
        .withIndex('by_userId_and_status', (q) =>
          q.eq('userId', user._id).eq('status', 'pending'),
        )
        .take(250)

      for (const siblingRow of siblingRows) {
        if (
          siblingRow._id !== row._id &&
          (siblingRow.dedupeKey ?? getEmailImportFingerprint(siblingRow)) ===
            rowFingerprint
        ) {
          await ctx.db.patch(siblingRow._id, {
            status: 'dismissed',
            updatedAt: now,
          })
        }
      }
    }

    await ctx.db.patch(row._id, {
      status: 'confirmed',
      confirmedExpenseId: expenseId,
      updatedAt: now,
    })

    return expenseId
  },
})

export const dismissEmailImport = mutation({
  args: { id: v.id('emailExpenseImports') },
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx)
    if (!authUser?.email) {
      throw new ConvexError('Unauthenticated')
    }

    const row = await ctx.db.get(args.id)
    if (!row) {
      return
    }

    const user = row.userId ? await ctx.db.get(row.userId) : null
    if (!user || user.email !== authUser.email) {
      throw new ConvexError('Unauthorized')
    }

    await ctx.db.patch(row._id, {
      status: 'dismissed',
      updatedAt: Date.now(),
    })
  },
})
