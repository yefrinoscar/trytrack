import { query, mutation } from './_generated/server'
import { ConvexError } from 'convex/values'
import { v } from 'convex/values'
import { authComponent } from './auth'

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

    return await ctx.db
      .query('emailExpenseImports')
      .withIndex('by_userId_and_status', (q) =>
        q.eq('userId', user._id).eq('status', 'pending'),
      )
      .order('desc')
      .take(25)
  },
})

export const confirmEmailImport = mutation({
  args: { id: v.id('emailExpenseImports') },
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

    const now = Date.now()
    const expenseId = await ctx.db.insert('expenses', {
      userId: user._id,
      amount: row.amount,
      currency: row.currency,
      category: 'Email import',
      description: row.merchant ?? row.subject ?? 'Email expense',
      merchant: row.merchant,
      spentAt: row.spentAt,
      createdAt: now,
      updatedAt: now,
    })

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
