import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

export const getState = query({
  args: { userEmail: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('gmailSyncStates')
      .withIndex('by_userEmail', (q) =>
        q.eq('userEmail', args.userEmail.toLowerCase()),
      )
      .first()
  },
})

export const upsertState = mutation({
  args: {
    userEmail: v.string(),
    historyId: v.optional(v.string()),
    watchExpiration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userEmail = args.userEmail.toLowerCase()
    const now = Date.now()
    const existing = await ctx.db
      .query('gmailSyncStates')
      .withIndex('by_userEmail', (q) => q.eq('userEmail', userEmail))
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...(args.historyId ? { historyId: args.historyId } : {}),
        ...(args.watchExpiration
          ? { watchExpiration: args.watchExpiration }
          : {}),
        updatedAt: now,
      })

      return existing._id
    }

    return await ctx.db.insert('gmailSyncStates', {
      userEmail,
      historyId: args.historyId,
      watchExpiration: args.watchExpiration,
      createdAt: now,
      updatedAt: now,
    })
  },
})
