import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  users: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    currency: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_email', ['email'])
    .index('by_createdAt', ['createdAt']),

  debts: defineTable({
    userId: v.id('users'),
    name: v.string(),
    lender: v.string(),
    type: v.union(
      v.literal('Credit card'),
      v.literal('Loan'),
      v.literal('Mortgage'),
      v.literal('Other'),
    ),
    currency: v.string(),
    balance: v.number(),
    rate: v.number(),
    payments: v.number(),
    paymentMode: v.optional(
      v.union(v.literal('installments'), v.literal('revolving')),
    ),
    remainingInstallments: v.optional(v.number()),
    minimumPayment: v.optional(v.number()),
    targetPayment: v.optional(v.number()),
    dueDay: v.optional(v.number()),
    dueDate: v.string(),
    originalBalance: v.optional(v.number()),
    currentPlanVersion: v.optional(v.number()),
    status: v.union(v.literal('active'), v.literal('closed')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_userId_and_status', ['userId', 'status'])
    .index('by_userId_and_currency', ['userId', 'currency'])
    .index('by_userId_and_dueDate', ['userId', 'dueDate'])
    .index('by_userId_and_status_and_dueDate', ['userId', 'status', 'dueDate']),

  debtPlans: defineTable({
    debtId: v.id('debts'),
    version: v.number(),
    principalAtStart: v.number(),
    installmentsTotal: v.number(),
    installmentAmount: v.number(),
    startMonth: v.string(),
    nextInstallmentNumber: v.number(),
    status: v.union(
      v.literal('active'),
      v.literal('restructured'),
      v.literal('completed'),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_debtId', ['debtId'])
    .index('by_debtId_and_version', ['debtId', 'version'])
    .index('by_debtId_and_status', ['debtId', 'status']),

  debtPayments: defineTable({
    debtId: v.id('debts'),
    planVersion: v.number(),
    installmentNumber: v.number(),
    amountPaid: v.number(),
    paidAt: v.string(),
    requestId: v.string(),
    createdAt: v.number(),
  })
    .index('by_debtId', ['debtId'])
    .index('by_debtId_and_planVersion', ['debtId', 'planVersion'])
    .index('by_debtId_and_planVersion_and_installmentNumber', [
      'debtId',
      'planVersion',
      'installmentNumber',
    ])
    .index('by_debtId_and_paidAt', ['debtId', 'paidAt'])
    .index('by_requestId', ['requestId']),

  recurringPayments: defineTable({
    userId: v.id('users'),
    name: v.string(),
    category: v.string(),
    currency: v.string(),
    amount: v.number(),
    cadence: v.union(v.literal('monthly')),
    dueDay: v.number(),
    startDate: v.string(),
    endDate: v.optional(v.string()),
    status: v.union(
      v.literal('active'),
      v.literal('paused'),
      v.literal('cancelled'),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_userId_and_status', ['userId', 'status'])
    .index('by_userId_and_dueDay', ['userId', 'dueDay'])
    .index('by_userId_and_status_and_dueDay', ['userId', 'status', 'dueDay']),

  expenses: defineTable({
    userId: v.id('users'),
    amount: v.number(),
    currency: v.string(),
    category: v.string(),
    description: v.string(),
    merchant: v.optional(v.string()),
    spentAt: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_userId_and_spentAt', ['userId', 'spentAt'])
    .index('by_userId_and_category', ['userId', 'category'])
    .index('by_userId_and_currency', ['userId', 'currency']),

  emailExpenseImports: defineTable({
    userId: v.optional(v.id('users')),
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
    category: v.optional(v.string()),
    dedupeKey: v.optional(v.string()),
    status: v.union(
      v.literal('pending'),
      v.literal('needs_review'),
      v.literal('confirmed'),
      v.literal('dismissed'),
    ),
    error: v.optional(v.string()),
    confirmedExpenseId: v.optional(v.id('expenses')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_emailId', ['emailId'])
    .index('by_messageId', ['messageId'])
    .index('by_dedupeKey', ['dedupeKey'])
    .index('by_userId_and_status', ['userId', 'status'])
    .index('by_userEmail_and_status', ['userEmail', 'status'])
    .index('by_userId_and_createdAt', ['userId', 'createdAt']),

  gmailSyncStates: defineTable({
    userEmail: v.string(),
    historyId: v.optional(v.string()),
    watchExpiration: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_userEmail', ['userEmail']),
})
