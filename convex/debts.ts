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

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

function getMonthKey(dateValue: string) {
  return dateValue.slice(0, 7)
}

function addMonths(monthKey: string, monthsToAdd: number) {
  const [yearText, monthText] = monthKey.split('-')
  const year = Number(yearText)
  const monthIndex = Number(monthText) - 1

  if (!Number.isInteger(year) || !Number.isInteger(monthIndex)) {
    return new Date().toISOString().slice(0, 7)
  }

  const date = new Date(Date.UTC(year, monthIndex, 1))
  date.setUTCMonth(date.getUTCMonth() + monthsToAdd)
  return date.toISOString().slice(0, 7)
}

function buildDueDate(monthKey: string, dueDay: number) {
  const [yearText, monthText] = monthKey.split('-')
  const year = Number(yearText)
  const monthIndex = Number(monthText) - 1

  if (!Number.isInteger(year) || !Number.isInteger(monthIndex)) {
    return new Date().toISOString().slice(0, 10)
  }

  const clampedDay = Math.max(1, Math.min(31, Math.round(dueDay)))
  const lastDayOfMonth = new Date(
    Date.UTC(year, monthIndex + 1, 0),
  ).getUTCDate()
  const nextDate = new Date(
    Date.UTC(year, monthIndex, Math.min(clampedDay, lastDayOfMonth)),
  )
  return nextDate.toISOString().slice(0, 10)
}

function getOriginalBalance(debt: {
  originalBalance?: number
  balance: number
}) {
  return roundMoney(
    typeof debt.originalBalance === 'number' && debt.originalBalance > 0
      ? debt.originalBalance
      : debt.balance,
  )
}

function getCurrentPlanVersion(debt: { currentPlanVersion?: number }) {
  return typeof debt.currentPlanVersion === 'number' &&
    debt.currentPlanVersion > 0
    ? Math.round(debt.currentPlanVersion)
    : 1
}

function getRemainingInstallments(debt: {
  payments: number
  remainingInstallments?: number
}) {
  const total = normalizeInstallments(debt.payments)

  if (typeof debt.remainingInstallments !== 'number') {
    return total
  }

  return Math.max(0, Math.min(total, Math.round(debt.remainingInstallments)))
}

function getSyntheticPlan(debt: {
  _creationTime?: number
  _id: string
  payments: number
  balance: number
  dueDate: string
  dueDay?: number
  status: 'active' | 'closed'
  originalBalance?: number
  currentPlanVersion?: number
  remainingInstallments?: number
  updatedAt?: number
}) {
  const installmentsTotal = normalizeInstallments(debt.payments)
  const remainingInstallments = getRemainingInstallments(debt)
  const paidCount = Math.max(0, installmentsTotal - remainingInstallments)
  const version = getCurrentPlanVersion(debt)
  const principalAtStart = getOriginalBalance(debt)
  const installmentAmount = roundMoney(principalAtStart / installmentsTotal)
  const now = debt.updatedAt ?? debt._creationTime ?? Date.now()

  return {
    debtId: debt._id,
    version,
    principalAtStart,
    installmentsTotal,
    installmentAmount,
    startMonth: getMonthKey(debt.dueDate),
    nextInstallmentNumber: Math.min(installmentsTotal + 1, paidCount + 1),
    status: debt.status === 'closed' ? 'completed' : 'active',
    createdAt: now,
    updatedAt: now,
  }
}

function pickLatestPlanForVersion<
  T extends {
    version: number
    createdAt: number
    updatedAt: number
  },
>(plans: T[]) {
  const plansByVersion = new Map<number, T>()

  for (const plan of plans) {
    const existing = plansByVersion.get(plan.version)
    if (
      !existing ||
      plan.updatedAt > existing.updatedAt ||
      (plan.updatedAt === existing.updatedAt &&
        plan.createdAt >= existing.createdAt)
    ) {
      plansByVersion.set(plan.version, plan)
    }
  }

  return Array.from(plansByVersion.values())
}

function dedupePaymentsById<
  T extends {
    _id: string
  },
>(payments: T[]) {
  const paymentsById = new Map<string, T>()

  for (const payment of payments) {
    paymentsById.set(payment._id, payment)
  }

  return Array.from(paymentsById.values())
}

async function getActivePlan(ctx: any, debt: any) {
  const activePlans = await ctx.db
    .query('debtPlans')
    .withIndex('by_debtId_and_status', (q: any) =>
      q.eq('debtId', debt._id).eq('status', 'active'),
    )
    .take(20)

  if (!activePlans.length) {
    return null
  }

  return pickLatestPlanForVersion(activePlans).sort(
    (left, right) =>
      right.version - left.version ||
      right.updatedAt - left.updatedAt ||
      right.createdAt - left.createdAt,
  )[0]
}

async function ensureActivePlan(ctx: any, debt: any) {
  const existingPlan = await getActivePlan(ctx, debt)

  if (existingPlan) {
    return existingPlan
  }

  const syntheticPlan = getSyntheticPlan(debt)
  const planId = await ctx.db.insert('debtPlans', syntheticPlan)
  await ctx.db.patch(debt._id, {
    originalBalance: syntheticPlan.principalAtStart,
    currentPlanVersion: syntheticPlan.version,
    remainingInstallments:
      syntheticPlan.installmentsTotal -
      (syntheticPlan.nextInstallmentNumber - 1),
    updatedAt: Date.now(),
  })

  return await ctx.db.get(planId)
}

function serializePlan(plan: {
  version: number
  principalAtStart: number
  installmentsTotal: number
  installmentAmount: number
  startMonth: string
  nextInstallmentNumber: number
  status: string
  createdAt: number
  updatedAt: number
}) {
  return {
    version: plan.version,
    principalAtStart: plan.principalAtStart,
    installmentsTotal: plan.installmentsTotal,
    installmentAmount: plan.installmentAmount,
    startMonth: plan.startMonth,
    nextInstallmentNumber: plan.nextInstallmentNumber,
    status: plan.status,
    createdAt: new Date(plan.createdAt).toISOString(),
    updatedAt: new Date(plan.updatedAt).toISOString(),
  }
}

function serializePayment(payment: {
  _id: string
  planVersion: number
  installmentNumber: number
  amountPaid: number
  paidAt: string
  createdAt: number
}) {
  return {
    id: payment._id,
    planVersion: payment.planVersion,
    installmentNumber: payment.installmentNumber,
    amountPaid: payment.amountPaid,
    paidAt: payment.paidAt,
    createdAt: new Date(payment.createdAt).toISOString(),
  }
}

function buildInstallmentOverview(
  debts: Array<{
    _id: string
    balance: number
    dueDate: string
    dueDay?: number
    payments: number
    remainingInstallments?: number
    originalBalance?: number
    currentPlanVersion?: number
    status: 'active' | 'closed'
    _creationTime?: number
    updatedAt?: number
  }>,
  storedPlans: Array<{
    debtId: string
    version: number
    principalAtStart: number
    installmentsTotal: number
    installmentAmount: number
    startMonth: string
    nextInstallmentNumber: number
    status: string
    createdAt: number
    updatedAt: number
  }>,
  storedPayments: Array<{
    _id: string
    debtId: string
    planVersion: number
    installmentNumber: number
    amountPaid: number
    paidAt: string
    createdAt: number
  }>,
) {
  const plansByDebtId = new Map<string, typeof storedPlans>()
  const paymentsByDebtId = new Map<string, typeof storedPayments>()

  for (const plan of storedPlans) {
    const list = plansByDebtId.get(plan.debtId) ?? []
    list.push(plan)
    plansByDebtId.set(plan.debtId, list)
  }

  for (const payment of storedPayments) {
    const list = paymentsByDebtId.get(payment.debtId) ?? []
    list.push(payment)
    paymentsByDebtId.set(payment.debtId, list)
  }

  return debts.map((debt) => {
    const plans = pickLatestPlanForVersion(plansByDebtId.get(debt._id) ?? [])
    const payments = dedupePaymentsById(paymentsByDebtId.get(debt._id) ?? [])

    return {
      debtId: debt._id,
      originalBalance: getOriginalBalance(debt),
      currentPlanVersion: getCurrentPlanVersion(debt),
      plans: (plans.length ? plans : [getSyntheticPlan(debt)])
        .slice()
        .sort((left, right) => left.version - right.version)
        .map(serializePlan),
      payments: payments
        .slice()
        .sort(
          (left, right) =>
            left.planVersion - right.planVersion ||
            left.installmentNumber - right.installmentNumber ||
            left.createdAt - right.createdAt,
        )
        .map(serializePayment),
    }
  })
}

function isPresent<T>(value: T | null): value is T {
  return value !== null
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

export const getInstallmentOverview = query({
  args: { debtIds: v.array(v.id('debts')) },
  handler: async (ctx, args) => {
    if (!args.debtIds.length) {
      return []
    }

    const debtIdSet = new Set(args.debtIds)
    const [debts, storedPlans, storedPayments] = await Promise.all([
      Promise.all(args.debtIds.map((debtId) => ctx.db.get(debtId))),
      ctx.db.query('debtPlans').take(500),
      ctx.db.query('debtPayments').take(2000),
    ])

    return buildInstallmentOverview(
      debts.filter(isPresent),
      storedPlans.filter((plan) => debtIdSet.has(plan.debtId)),
      storedPayments.filter((payment) => debtIdSet.has(payment.debtId)),
    )
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
    originalBalance: v.optional(v.number()),
    currentPlanVersion: v.optional(v.number()),
    status: v.optional(debtStatus),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const payments = normalizeInstallments(args.payments)
    const originalBalance = roundMoney(
      typeof args.originalBalance === 'number' && args.originalBalance > 0
        ? args.originalBalance
        : args.balance,
    )
    const currentPlanVersion =
      typeof args.currentPlanVersion === 'number' && args.currentPlanVersion > 0
        ? Math.round(args.currentPlanVersion)
        : 1

    const debtId = await ctx.db.insert('debts', {
      ...args,
      payments,
      paymentMode: args.paymentMode ?? defaultPaymentMode(args.type),
      remainingInstallments: payments,
      dueDay: args.dueDay ?? deriveDueDay(args.dueDate),
      dueDate: args.dueDate,
      originalBalance,
      currentPlanVersion,
      status: args.status ?? 'active',
      createdAt: now,
      updatedAt: now,
    })

    await ctx.db.insert('debtPlans', {
      debtId,
      version: currentPlanVersion,
      principalAtStart: originalBalance,
      installmentsTotal: payments,
      installmentAmount: roundMoney(originalBalance / payments),
      startMonth: getMonthKey(args.dueDate),
      nextInstallmentNumber: 1,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    })

    return debtId
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
    originalBalance: v.optional(v.number()),
    currentPlanVersion: v.optional(v.number()),
    status: v.optional(debtStatus),
  },
  handler: async (ctx, args) => {
    const { id, dueDate, dueDay, payments: nextPaymentsInput, ...value } = args
    const existing = await ctx.db.get(id)

    if (!existing) {
      throw new Error('Debt not found')
    }

    const nextDueDate = dueDate ?? existing.dueDate
    const nextDueDay = dueDay ?? deriveDueDay(nextDueDate)
    const nextBalance =
      typeof value.balance === 'number'
        ? roundMoney(value.balance)
        : existing.balance
    const activePlan = await ensureActivePlan(ctx, existing)
    const paidCount = Math.max(0, activePlan.nextInstallmentNumber - 1)
    const updates: Record<string, unknown> = {
      ...value,
      ...(dueDate ? { dueDate } : {}),
      ...(dueDate || dueDay ? { dueDay: nextDueDay } : {}),
      updatedAt: Date.now(),
    }

    if (typeof nextPaymentsInput === 'number') {
      const nextPayments = normalizeInstallments(nextPaymentsInput)

      if (paidCount > 0) {
        throw new Error(
          'Paid installments already exist. Use restructureInstallments instead.',
        )
      }

      updates.payments = nextPayments
      updates.remainingInstallments = nextPayments

      await ctx.db.patch(activePlan._id, {
        installmentsTotal: nextPayments,
        installmentAmount: roundMoney(nextBalance / nextPayments),
        nextInstallmentNumber: 1,
        updatedAt: Date.now(),
      })
    } else {
      const remainingInstallments = Math.max(
        0,
        activePlan.installmentsTotal - paidCount,
      )

      updates.remainingInstallments = remainingInstallments

      if (remainingInstallments > 0) {
        await ctx.db.patch(activePlan._id, {
          installmentAmount: roundMoney(nextBalance / remainingInstallments),
          updatedAt: Date.now(),
        })
      }
    }

    if (typeof value.originalBalance === 'number') {
      updates.originalBalance = roundMoney(value.originalBalance)
    } else if (paidCount === 0 && typeof value.balance === 'number') {
      updates.originalBalance = roundMoney(value.balance)
      await ctx.db.patch(activePlan._id, {
        principalAtStart: roundMoney(value.balance),
        installmentAmount: roundMoney(
          value.balance /
            (typeof updates.payments === 'number'
              ? (updates.payments as number)
              : activePlan.installmentsTotal),
        ),
        updatedAt: Date.now(),
      })
    }

    await ctx.db.patch(id, updates)
  },
})

export const payNextInstallment = mutation({
  args: {
    debtId: v.id('debts'),
    expectedInstallmentNumber: v.number(),
    paidAt: v.optional(v.string()),
    requestId: v.string(),
  },
  handler: async (ctx, args) => {
    const existingPayment = await ctx.db
      .query('debtPayments')
      .withIndex('by_requestId', (q) => q.eq('requestId', args.requestId))
      .unique()

    if (existingPayment) {
      return existingPayment
    }

    const debt = await ctx.db.get(args.debtId)

    if (!debt) {
      throw new Error('Debt not found')
    }

    if (debt.status === 'closed' || debt.balance <= 0) {
      throw new Error('Debt is already closed')
    }

    const activePlan = await ensureActivePlan(ctx, debt)
    const installmentNumber = activePlan.nextInstallmentNumber

    if (installmentNumber !== Math.round(args.expectedInstallmentNumber)) {
      throw new Error(
        'Installment state changed. Try again after the list refreshes.',
      )
    }

    if (installmentNumber > activePlan.installmentsTotal) {
      throw new Error('No pending installments left')
    }

    const existingInstallmentPayment = await ctx.db
      .query('debtPayments')
      .withIndex('by_debtId_and_planVersion_and_installmentNumber', (q) =>
        q
          .eq('debtId', args.debtId)
          .eq('planVersion', activePlan.version)
          .eq('installmentNumber', installmentNumber),
      )
      .unique()

    if (existingInstallmentPayment) {
      throw new Error('Next installment has already been paid')
    }

    const remainingInstallments = Math.max(
      1,
      activePlan.installmentsTotal - installmentNumber + 1,
    )
    const amountPaid = roundMoney(
      installmentNumber === activePlan.installmentsTotal
        ? debt.balance
        : Math.min(debt.balance, activePlan.installmentAmount),
    )
    const paidAt = args.paidAt ?? new Date().toISOString().slice(0, 10)
    const now = Date.now()
    const paymentId = await ctx.db.insert('debtPayments', {
      debtId: args.debtId,
      planVersion: activePlan.version,
      installmentNumber,
      amountPaid,
      paidAt,
      requestId: args.requestId,
      createdAt: now,
    })
    const nextBalance = roundMoney(Math.max(0, debt.balance - amountPaid))
    const nextInstallmentNumber = installmentNumber + 1
    const isCompleted =
      nextBalance <= 0 || nextInstallmentNumber > activePlan.installmentsTotal
    const nextDueDate = isCompleted
      ? debt.dueDate
      : buildDueDate(
          addMonths(getMonthKey(debt.dueDate), 1),
          debt.dueDay ?? deriveDueDay(debt.dueDate),
        )

    await ctx.db.patch(activePlan._id, {
      nextInstallmentNumber,
      status: isCompleted ? 'completed' : 'active',
      updatedAt: now,
    })

    await ctx.db.patch(args.debtId, {
      balance: nextBalance,
      remainingInstallments: Math.max(0, remainingInstallments - 1),
      dueDate: nextDueDate,
      status: isCompleted ? 'closed' : 'active',
      originalBalance: getOriginalBalance(debt),
      currentPlanVersion: activePlan.version,
      updatedAt: now,
    })

    return await ctx.db.get(paymentId)
  },
})

export const restructureInstallments = mutation({
  args: {
    debtId: v.id('debts'),
    payments: v.number(),
  },
  handler: async (ctx, args) => {
    const debt = await ctx.db.get(args.debtId)

    if (!debt) {
      throw new Error('Debt not found')
    }

    if (debt.status === 'closed' || debt.balance <= 0) {
      throw new Error('Debt is already closed')
    }

    const activePlan = await ensureActivePlan(ctx, debt)
    const nextPayments = normalizeInstallments(args.payments)
    const now = Date.now()

    await ctx.db.patch(activePlan._id, {
      status: 'restructured',
      updatedAt: now,
    })

    const nextVersion = activePlan.version + 1
    const nextStartMonth = addMonths(getMonthKey(debt.dueDate), 1)

    await ctx.db.insert('debtPlans', {
      debtId: args.debtId,
      version: nextVersion,
      principalAtStart: roundMoney(debt.balance),
      installmentsTotal: nextPayments,
      installmentAmount: roundMoney(debt.balance / nextPayments),
      startMonth: nextStartMonth,
      nextInstallmentNumber: 1,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    })

    await ctx.db.patch(args.debtId, {
      payments: nextPayments,
      remainingInstallments: nextPayments,
      currentPlanVersion: nextVersion,
      dueDate: buildDueDate(
        nextStartMonth,
        debt.dueDay ?? deriveDueDay(debt.dueDate),
      ),
      status: 'active',
      updatedAt: now,
    })
  },
})

export const payCustomAmount = mutation({
  args: {
    debtId: v.id('debts'),
    amountPaid: v.number(),
    expectedInstallmentNumber: v.number(),
    paidAt: v.optional(v.string()),
    requestId: v.string(),
  },
  handler: async (ctx, args) => {
    const debt = await ctx.db.get(args.debtId)

    if (!debt) {
      throw new Error('Debt not found')
    }

    if (debt.status === 'closed' || debt.balance <= 0) {
      throw new Error('Debt is already closed')
    }

    const activePlan = await ensureActivePlan(ctx, debt)
    const paymentAmount = roundMoney(args.amountPaid)

    if (paymentAmount <= 0) {
      throw new Error('Payment amount must be greater than 0')
    }

    if (paymentAmount > debt.balance) {
      throw new Error('Payment amount exceeds remaining balance')
    }

    const existingPayment = await ctx.db
      .query('debtPayments')
      .withIndex('by_requestId', (q) => q.eq('requestId', args.requestId))
      .unique()

    if (existingPayment) {
      return existingPayment
    }

    const now = Date.now()
    const installmentNumber = activePlan.nextInstallmentNumber
    const paidAt = args.paidAt ?? new Date().toISOString().slice(0, 10)

    if (installmentNumber !== Math.round(args.expectedInstallmentNumber)) {
      throw new Error(
        'Installment state changed. Try again after the list refreshes.',
      )
    }

    if (installmentNumber > activePlan.installmentsTotal) {
      throw new Error('No pending installments left')
    }

    const existingInstallmentPayment = await ctx.db
      .query('debtPayments')
      .withIndex('by_debtId_and_planVersion_and_installmentNumber', (q) =>
        q
          .eq('debtId', args.debtId)
          .eq('planVersion', activePlan.version)
          .eq('installmentNumber', installmentNumber),
      )
      .unique()

    if (existingInstallmentPayment) {
      throw new Error('This installment has already been paid')
    }

    await ctx.db.insert('debtPayments', {
      debtId: args.debtId,
      planVersion: activePlan.version,
      installmentNumber,
      amountPaid: paymentAmount,
      paidAt,
      requestId: args.requestId,
      createdAt: now,
    })

    const nextBalance = roundMoney(Math.max(0, debt.balance - paymentAmount))
    const nextInstallmentNumber = installmentNumber + 1
    const isCompleted = nextBalance <= 0

    const remainingInstallments = Math.max(
      0,
      activePlan.installmentsTotal - nextInstallmentNumber + 1,
    )

    let nextInstallmentAmount = activePlan.installmentAmount
    if (!isCompleted && remainingInstallments > 0) {
      nextInstallmentAmount = roundMoney(nextBalance / remainingInstallments)
    }

    const nextDueDate = isCompleted
      ? debt.dueDate
      : buildDueDate(
          addMonths(getMonthKey(debt.dueDate), 1),
          debt.dueDay ?? deriveDueDay(debt.dueDate),
        )

    await ctx.db.patch(activePlan._id, {
      nextInstallmentNumber,
      installmentAmount: nextInstallmentAmount,
      status: isCompleted ? 'completed' : 'active',
      updatedAt: now,
    })

    await ctx.db.patch(args.debtId, {
      balance: nextBalance,
      remainingInstallments,
      dueDate: nextDueDate,
      status: isCompleted ? 'closed' : 'active',
      originalBalance: getOriginalBalance(debt),
      currentPlanVersion: activePlan.version,
      updatedAt: now,
    })

    return await ctx.db.get(
      (await ctx.db
        .query('debtPayments')
        .withIndex('by_requestId', (q) => q.eq('requestId', args.requestId))
        .unique())!._id,
    )
  },
})

export const updateInstallmentAmount = mutation({
  args: {
    debtId: v.id('debts'),
    installmentAmount: v.number(),
  },
  handler: async (ctx, args) => {
    const debt = await ctx.db.get(args.debtId)

    if (!debt) {
      throw new Error('Debt not found')
    }

    if (debt.status === 'closed' || debt.balance <= 0) {
      throw new Error('Debt is already closed')
    }

    const activePlan = await ensureActivePlan(ctx, debt)
    const paymentAmount = roundMoney(args.installmentAmount)

    if (paymentAmount <= 0) {
      throw new Error('Installment amount must be greater than 0')
    }

    const totalInstallments = Math.ceil(debt.balance / paymentAmount)
    const now = Date.now()

    await ctx.db.patch(activePlan._id, {
      installmentsTotal: totalInstallments,
      installmentAmount: paymentAmount,
      nextInstallmentNumber: 1,
      status: 'active',
      updatedAt: now,
    })

    await ctx.db.patch(args.debtId, {
      payments: totalInstallments,
      remainingInstallments: totalInstallments,
      currentPlanVersion: activePlan.version,
      updatedAt: now,
    })
  },
})

export const undoLastPayment = mutation({
  args: {
    debtId: v.id('debts'),
    paymentId: v.id('debtPayments'),
  },
  handler: async (ctx, args) => {
    const debt = await ctx.db.get(args.debtId)

    if (!debt) {
      throw new Error('Debt not found')
    }

    const payment = await ctx.db.get(args.paymentId)

    if (!payment || payment.debtId !== args.debtId) {
      throw new Error('Payment not found')
    }

    const allPayments = await ctx.db
      .query('debtPayments')
      .withIndex('by_debtId', (q) => q.eq('debtId', args.debtId))
      .take(500)

    const sortedPayments = allPayments
      .slice()
      .sort(
        (a, b) =>
          b.createdAt - a.createdAt ||
          b.installmentNumber - a.installmentNumber,
      )

    if (sortedPayments[0]?._id !== args.paymentId) {
      throw new Error('Can only undo the most recent payment')
    }

    const paymentPlans = await ctx.db
      .query('debtPlans')
      .withIndex('by_debtId_and_version', (q) =>
        q.eq('debtId', args.debtId).eq('version', payment.planVersion),
      )
      .take(20)
    const paymentPlan = pickLatestPlanForVersion(paymentPlans)[0]

    if (!paymentPlan) {
      throw new Error('Payment plan not found')
    }

    const laterPlans = await ctx.db
      .query('debtPlans')
      .withIndex('by_debtId', (q) => q.eq('debtId', args.debtId))
      .take(100)
    const plansToRemove = laterPlans.filter(
      (plan) => plan.version > payment.planVersion,
    )
    const now = Date.now()
    const nextBalance = roundMoney(debt.balance + payment.amountPaid)
    const nextInstallmentNumber = payment.installmentNumber

    await ctx.db.delete(args.paymentId)
    await Promise.all(plansToRemove.map((plan) => ctx.db.delete(plan._id)))

    await ctx.db.patch(paymentPlan._id, {
      nextInstallmentNumber,
      status: 'active',
      updatedAt: now,
    })

    await ctx.db.patch(args.debtId, {
      balance: nextBalance,
      remainingInstallments:
        paymentPlan.installmentsTotal - nextInstallmentNumber + 1,
      status: 'active',
      currentPlanVersion: paymentPlan.version,
      updatedAt: now,
    })
  },
})

export const remove = mutation({
  args: { id: v.id('debts') },
  handler: async (ctx, args) => {
    const plans = await ctx.db
      .query('debtPlans')
      .withIndex('by_debtId', (q) => q.eq('debtId', args.id))
      .take(100)
    const payments = await ctx.db
      .query('debtPayments')
      .withIndex('by_debtId', (q) => q.eq('debtId', args.id))
      .take(500)

    await Promise.all(payments.map((payment) => ctx.db.delete(payment._id)))
    await Promise.all(plans.map((plan) => ctx.db.delete(plan._id)))
    await ctx.db.delete(args.id)
  },
})
