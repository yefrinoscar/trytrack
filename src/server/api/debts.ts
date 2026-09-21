import { and, asc, eq, inArray } from 'drizzle-orm'
import { getDb } from '../db/client'
import { debtPayments, debtPlans, debts } from '../db/schema'
import { newId } from '../db/ids'
import { toDoc } from '../db/serialize'
import { requireOwnDebt, requireOwnDebts, requireOwnUserId } from './authz'
import type { InferSelectModel } from 'drizzle-orm'

type DebtRow = InferSelectModel<typeof debts>
type DebtPlanRow = InferSelectModel<typeof debtPlans>
type DebtPaymentRow = InferSelectModel<typeof debtPayments>

const debtTypes = ['Credit card', 'Loan', 'Mortgage', 'Other'] as const
type DebtType = (typeof debtTypes)[number]

function deriveDueDay(dueDate: string) {
  const parsed = new Date(`${dueDate}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? 1 : parsed.getUTCDate()
}

function defaultPaymentMode(type: string) {
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

function getOriginalBalance(
  debt: Pick<DebtRow, 'originalBalance' | 'balance'>,
) {
  return roundMoney(
    typeof debt.originalBalance === 'number' && debt.originalBalance > 0
      ? debt.originalBalance
      : debt.balance,
  )
}

function getCurrentPlanVersion(debt: Pick<DebtRow, 'currentPlanVersion'>) {
  return typeof debt.currentPlanVersion === 'number' &&
    debt.currentPlanVersion > 0
    ? Math.round(debt.currentPlanVersion)
    : 1
}

function getRemainingInstallments(
  debt: Pick<DebtRow, 'payments' | 'remainingInstallments'>,
) {
  const total = normalizeInstallments(debt.payments)

  if (typeof debt.remainingInstallments !== 'number') {
    return total
  }

  return Math.max(0, Math.min(total, Math.round(debt.remainingInstallments)))
}

function getSyntheticPlan(
  debt: Pick<
    DebtRow,
    | 'id'
    | 'payments'
    | 'balance'
    | 'dueDate'
    | 'status'
    | 'originalBalance'
    | 'currentPlanVersion'
    | 'remainingInstallments'
    | 'createdAt'
    | 'updatedAt'
  >,
) {
  const installmentsTotal = normalizeInstallments(debt.payments)
  const remainingInstallments = getRemainingInstallments(debt)
  const paidCount = Math.max(0, installmentsTotal - remainingInstallments)
  const version = getCurrentPlanVersion(debt)
  const principalAtStart = getOriginalBalance(debt)
  const installmentAmount = roundMoney(principalAtStart / installmentsTotal)
  const now = debt.updatedAt ?? debt.createdAt ?? Date.now()

  return {
    id: newId(),
    debtId: debt.id,
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
  T extends { version: number; createdAt: number; updatedAt: number },
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

function dedupePaymentsById<T extends { id: string }>(payments: T[]) {
  const paymentsById = new Map<string, T>()
  for (const payment of payments) {
    paymentsById.set(payment.id, payment)
  }
  return Array.from(paymentsById.values())
}

async function getStoredPlans(debtId: string) {
  const db = await getDb()
  return await db
    .select()
    .from(debtPlans)
    .where(eq(debtPlans.debtId, debtId))
    .limit(100)
}

async function getActivePlan(debt: DebtRow) {
  const db = await getDb()
  const activePlans = await db
    .select()
    .from(debtPlans)
    .where(and(eq(debtPlans.debtId, debt.id), eq(debtPlans.status, 'active')))
    .limit(20)

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

async function ensureActivePlan(debt: DebtRow) {
  const existingPlan = await getActivePlan(debt)
  if (existingPlan) {
    return existingPlan
  }

  const db = await getDb()
  const syntheticPlan = getSyntheticPlan(debt)
  await db.insert(debtPlans).values(syntheticPlan)
  await db
    .update(debts)
    .set({
      originalBalance: syntheticPlan.principalAtStart,
      currentPlanVersion: syntheticPlan.version,
      remainingInstallments:
        syntheticPlan.installmentsTotal -
        (syntheticPlan.nextInstallmentNumber - 1),
      updatedAt: Date.now(),
    })
    .where(eq(debts.id, debt.id))

  const [created] = await db
    .select()
    .from(debtPlans)
    .where(eq(debtPlans.id, syntheticPlan.id))
    .limit(1)
  return created!
}

function serializePlan(plan: DebtPlanRow) {
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

function serializePayment(payment: DebtPaymentRow) {
  return {
    id: payment.id,
    planVersion: payment.planVersion,
    installmentNumber: payment.installmentNumber,
    amountPaid: payment.amountPaid,
    paidAt: payment.paidAt,
    createdAt: new Date(payment.createdAt).toISOString(),
  }
}

function buildInstallmentOverview(
  debtRows: DebtRow[],
  storedPlans: DebtPlanRow[],
  storedPayments: DebtPaymentRow[],
) {
  const plansByDebtId = new Map<string, DebtPlanRow[]>()
  const paymentsByDebtId = new Map<string, DebtPaymentRow[]>()

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

  return debtRows.map((debt) => {
    const plans = pickLatestPlanForVersion(plansByDebtId.get(debt.id) ?? [])
    const payments = dedupePaymentsById(paymentsByDebtId.get(debt.id) ?? [])

    return {
      debtId: debt.id,
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

export async function listByUser(args: { userId: string }) {
  await requireOwnUserId(args.userId)

  const db = await getDb()
  const rows = await db
    .select()
    .from(debts)
    .where(eq(debts.userId, args.userId))
    .orderBy(asc(debts.dueDate))
    .limit(100)
  return rows.map(toDoc)
}

export async function getInstallmentOverview(args: { debtIds: string[] }) {
  if (!args.debtIds.length) {
    return []
  }

  await requireOwnDebts(args.debtIds)

  const db = await getDb()
  const debtIdSet = new Set(args.debtIds)
  const [debtRows, storedPlans, storedPayments] = await Promise.all([
    db.select().from(debts).where(inArray(debts.id, args.debtIds)),
    db.select().from(debtPlans).limit(500),
    db.select().from(debtPayments).limit(2000),
  ])

  return buildInstallmentOverview(
    debtRows,
    storedPlans.filter((plan) => debtIdSet.has(plan.debtId)),
    storedPayments.filter((payment) => debtIdSet.has(payment.debtId)),
  )
}

export async function create(args: {
  userId: string
  name: string
  lender: string
  type: DebtType
  currency: string
  balance: number
  rate: number
  payments: number
  paymentMode?: 'installments' | 'revolving'
  remainingInstallments?: number
  minimumPayment?: number
  targetPayment?: number
  dueDay?: number
  dueDate: string
  originalBalance?: number
  currentPlanVersion?: number
  status?: 'active' | 'closed'
}) {
  await requireOwnUserId(args.userId)

  const db = await getDb()
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

  const debtId = newId()
  await db.insert(debts).values({
    id: debtId,
    userId: args.userId,
    name: args.name,
    lender: args.lender,
    type: args.type,
    currency: args.currency,
    balance: args.balance,
    rate: args.rate,
    payments,
    paymentMode: args.paymentMode ?? defaultPaymentMode(args.type),
    remainingInstallments: payments,
    minimumPayment: args.minimumPayment ?? null,
    targetPayment: args.targetPayment ?? null,
    dueDay: args.dueDay ?? deriveDueDay(args.dueDate),
    dueDate: args.dueDate,
    originalBalance,
    currentPlanVersion,
    status: args.status ?? 'active',
    createdAt: now,
    updatedAt: now,
  })

  await db.insert(debtPlans).values({
    id: newId(),
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
}

export async function update(args: {
  id: string
  name?: string
  lender?: string
  type?: DebtType
  currency?: string
  balance?: number
  rate?: number
  payments?: number
  paymentMode?: 'installments' | 'revolving'
  remainingInstallments?: number
  minimumPayment?: number
  targetPayment?: number
  dueDay?: number
  dueDate?: string
  originalBalance?: number
  currentPlanVersion?: number
  status?: 'active' | 'closed'
}) {
  await requireOwnDebt(args.id)

  const db = await getDb()
  const { id, dueDate, dueDay, payments: nextPaymentsInput, ...value } = args
  const [existing] = await db
    .select()
    .from(debts)
    .where(eq(debts.id, id))
    .limit(1)

  if (!existing) {
    throw new Error('Debt not found')
  }

  const nextDueDate = dueDate ?? existing.dueDate
  const nextDueDay = dueDay ?? deriveDueDay(nextDueDate)
  const nextBalance =
    typeof value.balance === 'number'
      ? roundMoney(value.balance)
      : existing.balance
  const activePlan = await ensureActivePlan(existing)
  const paidCount = Math.max(0, activePlan.nextInstallmentNumber - 1)
  const updates: Partial<DebtRow> = {
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

    await db
      .update(debtPlans)
      .set({
        installmentsTotal: nextPayments,
        installmentAmount: roundMoney(nextBalance / nextPayments),
        nextInstallmentNumber: 1,
        updatedAt: Date.now(),
      })
      .where(eq(debtPlans.id, activePlan.id))
  } else {
    const remainingInstallments = Math.max(
      0,
      activePlan.installmentsTotal - paidCount,
    )
    updates.remainingInstallments = remainingInstallments

    if (remainingInstallments > 0) {
      await db
        .update(debtPlans)
        .set({
          installmentAmount: roundMoney(nextBalance / remainingInstallments),
          updatedAt: Date.now(),
        })
        .where(eq(debtPlans.id, activePlan.id))
    }
  }

  if (typeof value.originalBalance === 'number') {
    updates.originalBalance = roundMoney(value.originalBalance)
  } else if (paidCount === 0 && typeof value.balance === 'number') {
    updates.originalBalance = roundMoney(value.balance)
    await db
      .update(debtPlans)
      .set({
        principalAtStart: roundMoney(value.balance),
        installmentAmount: roundMoney(
          value.balance /
            (typeof updates.payments === 'number'
              ? updates.payments
              : activePlan.installmentsTotal),
        ),
        updatedAt: Date.now(),
      })
      .where(eq(debtPlans.id, activePlan.id))
  }

  await db.update(debts).set(updates).where(eq(debts.id, id))
}

export async function payNextInstallment(args: {
  debtId: string
  expectedInstallmentNumber: number
  paidAt?: string
  requestId: string
}) {
  await requireOwnDebt(args.debtId)

  const db = await getDb()
  const [existingPayment] = await db
    .select()
    .from(debtPayments)
    .where(eq(debtPayments.requestId, args.requestId))
    .limit(1)

  if (existingPayment) {
    return toDoc(existingPayment)
  }

  const [debt] = await db
    .select()
    .from(debts)
    .where(eq(debts.id, args.debtId))
    .limit(1)

  if (!debt) {
    throw new Error('Debt not found')
  }

  if (debt.status === 'closed' || debt.balance <= 0) {
    throw new Error('Debt is already closed')
  }

  const activePlan = await ensureActivePlan(debt)
  const installmentNumber = activePlan.nextInstallmentNumber

  if (installmentNumber !== Math.round(args.expectedInstallmentNumber)) {
    throw new Error(
      'Installment state changed. Try again after the list refreshes.',
    )
  }

  if (installmentNumber > activePlan.installmentsTotal) {
    throw new Error('No pending installments left')
  }

  const [existingInstallmentPayment] = await db
    .select()
    .from(debtPayments)
    .where(
      and(
        eq(debtPayments.debtId, args.debtId),
        eq(debtPayments.planVersion, activePlan.version),
        eq(debtPayments.installmentNumber, installmentNumber),
      ),
    )
    .limit(1)

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
  const paymentId = newId()
  await db.insert(debtPayments).values({
    id: paymentId,
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

  await db
    .update(debtPlans)
    .set({
      nextInstallmentNumber,
      status: isCompleted ? 'completed' : 'active',
      updatedAt: now,
    })
    .where(eq(debtPlans.id, activePlan.id))

  await db
    .update(debts)
    .set({
      balance: nextBalance,
      remainingInstallments: Math.max(0, remainingInstallments - 1),
      dueDate: nextDueDate,
      status: isCompleted ? 'closed' : 'active',
      originalBalance: getOriginalBalance(debt),
      currentPlanVersion: activePlan.version,
      updatedAt: now,
    })
    .where(eq(debts.id, args.debtId))

  const [payment] = await db
    .select()
    .from(debtPayments)
    .where(eq(debtPayments.id, paymentId))
    .limit(1)
  return payment ? toDoc(payment) : null
}

export async function restructureInstallments(args: {
  debtId: string
  payments: number
}) {
  await requireOwnDebt(args.debtId)

  const db = await getDb()
  const [debt] = await db
    .select()
    .from(debts)
    .where(eq(debts.id, args.debtId))
    .limit(1)

  if (!debt) {
    throw new Error('Debt not found')
  }

  if (debt.status === 'closed' || debt.balance <= 0) {
    throw new Error('Debt is already closed')
  }

  const activePlan = await ensureActivePlan(debt)
  const nextPayments = normalizeInstallments(args.payments)
  const now = Date.now()

  await db
    .update(debtPlans)
    .set({ status: 'restructured', updatedAt: now })
    .where(eq(debtPlans.id, activePlan.id))

  const nextVersion = activePlan.version + 1
  const nextStartMonth = addMonths(getMonthKey(debt.dueDate), 1)

  await db.insert(debtPlans).values({
    id: newId(),
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

  await db
    .update(debts)
    .set({
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
    .where(eq(debts.id, args.debtId))
}

export async function payCustomAmount(args: {
  debtId: string
  amountPaid: number
  expectedInstallmentNumber: number
  paidAt?: string
  requestId: string
}) {
  await requireOwnDebt(args.debtId)

  const db = await getDb()
  const [debt] = await db
    .select()
    .from(debts)
    .where(eq(debts.id, args.debtId))
    .limit(1)

  if (!debt) {
    throw new Error('Debt not found')
  }

  if (debt.status === 'closed' || debt.balance <= 0) {
    throw new Error('Debt is already closed')
  }

  const activePlan = await ensureActivePlan(debt)
  const paymentAmount = roundMoney(args.amountPaid)

  if (paymentAmount <= 0) {
    throw new Error('Payment amount must be greater than 0')
  }

  if (paymentAmount > debt.balance) {
    throw new Error('Payment amount exceeds remaining balance')
  }

  const [existingPayment] = await db
    .select()
    .from(debtPayments)
    .where(eq(debtPayments.requestId, args.requestId))
    .limit(1)

  if (existingPayment) {
    return toDoc(existingPayment)
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

  const [existingInstallmentPayment] = await db
    .select()
    .from(debtPayments)
    .where(
      and(
        eq(debtPayments.debtId, args.debtId),
        eq(debtPayments.planVersion, activePlan.version),
        eq(debtPayments.installmentNumber, installmentNumber),
      ),
    )
    .limit(1)

  if (existingInstallmentPayment) {
    throw new Error('This installment has already been paid')
  }

  await db.insert(debtPayments).values({
    id: newId(),
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

  await db
    .update(debtPlans)
    .set({
      nextInstallmentNumber,
      installmentAmount: nextInstallmentAmount,
      status: isCompleted ? 'completed' : 'active',
      updatedAt: now,
    })
    .where(eq(debtPlans.id, activePlan.id))

  await db
    .update(debts)
    .set({
      balance: nextBalance,
      remainingInstallments,
      dueDate: nextDueDate,
      status: isCompleted ? 'closed' : 'active',
      originalBalance: getOriginalBalance(debt),
      currentPlanVersion: activePlan.version,
      updatedAt: now,
    })
    .where(eq(debts.id, args.debtId))

  const [payment] = await db
    .select()
    .from(debtPayments)
    .where(eq(debtPayments.requestId, args.requestId))
    .limit(1)
  return payment ? toDoc(payment) : null
}

export async function updateInstallmentAmount(args: {
  debtId: string
  installmentAmount: number
}) {
  await requireOwnDebt(args.debtId)

  const db = await getDb()
  const [debt] = await db
    .select()
    .from(debts)
    .where(eq(debts.id, args.debtId))
    .limit(1)

  if (!debt) {
    throw new Error('Debt not found')
  }

  if (debt.status === 'closed' || debt.balance <= 0) {
    throw new Error('Debt is already closed')
  }

  const activePlan = await ensureActivePlan(debt)
  const paymentAmount = roundMoney(args.installmentAmount)

  if (paymentAmount <= 0) {
    throw new Error('Installment amount must be greater than 0')
  }

  const totalInstallments = Math.ceil(debt.balance / paymentAmount)
  const now = Date.now()

  await db
    .update(debtPlans)
    .set({
      installmentsTotal: totalInstallments,
      installmentAmount: paymentAmount,
      nextInstallmentNumber: 1,
      status: 'active',
      updatedAt: now,
    })
    .where(eq(debtPlans.id, activePlan.id))

  await db
    .update(debts)
    .set({
      payments: totalInstallments,
      remainingInstallments: totalInstallments,
      currentPlanVersion: activePlan.version,
      updatedAt: now,
    })
    .where(eq(debts.id, args.debtId))
}

export async function undoLastPayment(args: {
  debtId: string
  paymentId: string
}) {
  await requireOwnDebt(args.debtId)

  const db = await getDb()
  const [debt] = await db
    .select()
    .from(debts)
    .where(eq(debts.id, args.debtId))
    .limit(1)

  if (!debt) {
    throw new Error('Debt not found')
  }

  const [payment] = await db
    .select()
    .from(debtPayments)
    .where(eq(debtPayments.id, args.paymentId))
    .limit(1)

  if (!payment || payment.debtId !== args.debtId) {
    throw new Error('Payment not found')
  }

  const allPayments = await db
    .select()
    .from(debtPayments)
    .where(eq(debtPayments.debtId, args.debtId))
    .limit(500)

  const sortedPayments = allPayments
    .slice()
    .sort(
      (a, b) =>
        b.createdAt - a.createdAt || b.installmentNumber - a.installmentNumber,
    )

  if (sortedPayments[0]?.id !== args.paymentId) {
    throw new Error('Can only undo the most recent payment')
  }

  const paymentPlans = await db
    .select()
    .from(debtPlans)
    .where(
      and(
        eq(debtPlans.debtId, args.debtId),
        eq(debtPlans.version, payment.planVersion),
      ),
    )
    .limit(20)
  const paymentPlan = pickLatestPlanForVersion(paymentPlans)[0]

  if (!paymentPlan) {
    throw new Error('Payment plan not found')
  }

  const laterPlans = await db
    .select()
    .from(debtPlans)
    .where(eq(debtPlans.debtId, args.debtId))
    .limit(100)
  const plansToRemove = laterPlans.filter(
    (plan) => plan.version > payment.planVersion,
  )
  const now = Date.now()
  const nextBalance = roundMoney(debt.balance + payment.amountPaid)
  const nextInstallmentNumber = payment.installmentNumber

  await db.delete(debtPayments).where(eq(debtPayments.id, args.paymentId))
  for (const plan of plansToRemove) {
    await db.delete(debtPlans).where(eq(debtPlans.id, plan.id))
  }

  await db
    .update(debtPlans)
    .set({ nextInstallmentNumber, status: 'active', updatedAt: now })
    .where(eq(debtPlans.id, paymentPlan.id))

  await db
    .update(debts)
    .set({
      balance: nextBalance,
      remainingInstallments:
        paymentPlan.installmentsTotal - nextInstallmentNumber + 1,
      status: 'active',
      currentPlanVersion: paymentPlan.version,
      updatedAt: now,
    })
    .where(eq(debts.id, args.debtId))
}

export async function remove(args: { id: string }) {
  await requireOwnDebt(args.id)

  const db = await getDb()
  await db.delete(debtPayments).where(eq(debtPayments.debtId, args.id))
  await db.delete(debtPlans).where(eq(debtPlans.debtId, args.id))
  await db.delete(debts).where(eq(debts.id, args.id))
}

export { getStoredPlans, serializePlan, serializePayment }
