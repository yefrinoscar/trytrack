import { mutation, query } from './_generated/server'
import { ConvexError } from 'convex/values'
import { v } from 'convex/values'

import { authComponent } from './auth'

export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx)
    if (!authUser?.email || authUser.email !== args.email) {
      return null
    }

    return await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', args.email))
      .unique()
  },
})

/** App profile for the signed-in Better Auth user (no row until {@link ensureCurrent} runs). */
export const current = query({
  args: {},
  handler: async (ctx) => {
    const authUser = await authComponent.safeGetAuthUser(ctx)
    if (!authUser?.email) {
      return null
    }

    return await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', authUser.email))
      .unique()
  },
})

/**
 * Creates or returns the `users` row keyed by the authenticated Better Auth email.
 * All Convex data for the dashboard should use this user id.
 */
export const ensureCurrent = mutation({
  args: { currency: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx)
    if (!authUser?.email) {
      throw new ConvexError('Unauthenticated')
    }

    const existing = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', authUser.email))
      .unique()

    if (existing) {
      return existing
    }

    const now = Date.now()
    const name =
      typeof authUser.name === 'string' && authUser.name.length > 0
        ? authUser.name
        : undefined

    const id = await ctx.db.insert('users', {
      email: authUser.email,
      name,
      currency: args.currency ?? 'USD',
      createdAt: now,
      updatedAt: now,
    })

    const created = await ctx.db.get(id)
    if (!created) {
      throw new ConvexError('Failed to create user')
    }
    return created
  },
})

export const create = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    currency: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx)
    if (!authUser?.email || authUser.email !== args.email) {
      throw new ConvexError('Unauthorized')
    }

    const existing = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', args.email))
      .unique()

    if (existing) {
      return existing._id
    }

    const now = Date.now()
    return await ctx.db.insert('users', {
      email: args.email,
      name: args.name,
      currency: args.currency,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const update = mutation({
  args: {
    id: v.id('users'),
    name: v.optional(v.string()),
    currency: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx)
    if (!authUser?.email) {
      throw new ConvexError('Unauthorized')
    }

    const row = await ctx.db.get(args.id)
    if (!row || row.email !== authUser.email) {
      throw new ConvexError('Unauthorized')
    }

    await ctx.db.patch(args.id, {
      name: args.name,
      currency: args.currency,
      updatedAt: Date.now(),
    })
  },
})
