import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

const debtType = v.union(
  v.literal('Credit card'),
  v.literal('Loan'),
  v.literal('Mortgage'),
  v.literal('Other'),
)

const debtStatus = v.union(v.literal('active'), v.literal('closed'))

const paymentMode = v.union(v.literal('installments'), v.literal('revolving'))

function deriveDueDay(dueDate: string) {
  const parsed = new Date(`${dueDate}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? 1 : parsed.getUTCDate()
}

function defaultPaymentMode(
  type: 'Credit card' | 'Loan' | 'Mortgage' | 'Other',
) {
  return type === 'Credit card' ? 'revolving' : 'installments'
}

function normalizeInstallments(value: number) {
  return Math.max(1, Math.round(value))
}

export const listByUser = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('debts')
      .withIndex('by_userId_and_dueDate', (q) => q.eq('userId', args.userId))
      .take(100)
  },
})

export const create = mutation({
  args: {
    userId: v.id('users'),
    name: v.string(),
    lender: v.string(),
    type: debtType,
    currency: v.string(),
    balance: v.number(),
    rate: v.number(),
    payments: v.number(),
    paymentMode: v.optional(paymentMode),
    remainingInstallments: v.optional(v.number()),
    minimumPayment: v.optional(v.number()),
    targetPayment: v.optional(v.number()),
    dueDay: v.optional(v.number()),
    dueDate: v.string(),
    status: v.optional(debtStatus),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const payments = normalizeInstallments(args.payments)
    const remainingInstallments =
      typeof args.remainingInstallments === 'number'
        ? normalizeInstallments(args.remainingInstallments)
        : payments

    return await ctx.db.insert('debts', {
      ...args,
      payments,
      paymentMode: args.paymentMode ?? defaultPaymentMode(args.type),
      remainingInstallments,
      dueDay: args.dueDay ?? deriveDueDay(args.dueDate),
      status: args.status ?? 'active',
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const update = mutation({
  args: {
    id: v.id('debts'),
    name: v.optional(v.string()),
    lender: v.optional(v.string()),
    type: v.optional(debtType),
    currency: v.optional(v.string()),
    balance: v.optional(v.number()),
    rate: v.optional(v.number()),
    payments: v.optional(v.number()),
    paymentMode: v.optional(paymentMode),
    remainingInstallments: v.optional(v.number()),
    minimumPayment: v.optional(v.number()),
    targetPayment: v.optional(v.number()),
    dueDay: v.optional(v.number()),
    dueDate: v.optional(v.string()),
    status: v.optional(debtStatus),
  },
  handler: async (ctx, args) => {
    const { id, dueDate, dueDay, ...value } = args
    const payments =
      typeof value.payments === 'number'
        ? normalizeInstallments(value.payments)
        : undefined
    const remainingInstallments =
      typeof payments === 'number'
        ? payments
        : typeof value.remainingInstallments === 'number'
          ? normalizeInstallments(value.remainingInstallments)
          : undefined

    await ctx.db.patch(id, {
      ...value,
      ...(typeof payments === 'number' ? { payments } : {}),
      ...(typeof remainingInstallments === 'number'
        ? { remainingInstallments }
        : {}),
      ...(dueDate ? { dueDate } : {}),
      ...(dueDate || dueDay
        ? {
            dueDay:
              dueDay ??
              deriveDueDay(dueDate ?? new Date().toISOString().slice(0, 10)),
          }
        : {}),
      updatedAt: Date.now(),
    })
  },
})

export const remove = mutation({
  args: { id: v.id('debts') },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
  },
})
