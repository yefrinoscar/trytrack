import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useConvex } from 'convex/react'
import { useMemo } from 'react'
import { api } from '../../convex/_generated/api'
import type { Doc, Id } from '../../convex/_generated/dataModel'

export type DebtType = 'Credit card' | 'Loan' | 'Mortgage' | 'Other'
export type DebtPaymentMode = 'installments' | 'revolving'
export type DebtStatus = 'active' | 'closed'
export type IncomeFrequency =
  | 'Weekly'
  | 'Biweekly'
  | 'Monthly'
  | 'Quarterly'
  | 'Yearly'
  | 'One-time'
export type InvestmentType =
  | 'ETF'
  | 'Retirement'
  | 'Crypto'
  | 'Brokerage'
  | 'Cash'
export type GoalType = 'Emergency' | 'Debt payoff' | 'Investment' | 'Income'

export interface Debt {
  id: string
  name: string
  lender: string
  type: DebtType
  currency: string
  balance: number
  rate: number
  payments: number
  paymentMode?: DebtPaymentMode
  remainingInstallments?: number
  minimumPayment?: number
  targetPayment?: number
  dueDay?: number
  dueDate: string
  status?: DebtStatus
  createdAt: string
  updatedAt?: string
}

export interface Expense {
  id: string
  amount: number
  currency: string
  category: string
  description: string
  merchant?: string
  spentAt: string
  createdAt: string
  updatedAt?: string
}

export interface Income {
  id: string
  name: string
  source: string
  amount: number
  frequency: IncomeFrequency
  nextDate: string
  createdAt: string
}

export interface Investment {
  id: string
  name: string
  account: string
  type: InvestmentType
  currentValue: number
  monthlyContribution: number
  changePct: number
  createdAt: string
}

export interface Goal {
  id: string
  name: string
  type: GoalType
  target: number
  current: number
  deadline: string
  createdAt: string
}

export interface DashboardSettings {
  currency: string
  lastUpdated: string
}

export type RecurringPaymentStatus = 'active' | 'paused' | 'cancelled'

export interface RecurringPayment {
  id: string
  name: string
  category: string
  amount: number
  currency: string
  cadence?: 'monthly'
  dueDay: number
  status: RecurringPaymentStatus
  startDate: string
  endDate?: string
  createdAt: string
  updatedAt?: string
}

export interface DashboardData {
  debts: Debt[]
  expenses: Expense[]
  incomes: Income[]
  investments: Investment[]
  goals: Goal[]
  recurringPayments: RecurringPayment[]
  settings: DashboardSettings
}

export type RecentEntryKind = 'Debt' | 'Income' | 'Investment' | 'Goal'

export interface RecentEntry {
  id: string
  label: string
  kind: RecentEntryKind
  meta: string
  amount: number
  createdAt: string
}

export interface DebtProjectionPoint {
  monthIndex: number
  label: string
  balance: number
}

export interface DebtMonthPlanItem {
  id: string
  name: string
  payment: number
  interest: number
  principal: number
  endingBalance: number
}

export interface DebtMonthPlanRow {
  monthIndex: number
  label: string
  totalPayment: number
  interest: number
  principal: number
  endingBalance: number
  debts: DebtMonthPlanItem[]
}

export interface MonthlySpendCurrencySummary {
  currency: string
  plannedDebtPayments: number
  plannedRecurringPayments: number
  actualExpenses: number
  totalMonthlySpend: number
}

export interface MonthlySpendSummary {
  month: string
  plannedDebtPayments: number
  plannedRecurringPayments: number
  actualExpenses: number
  totalMonthlySpend: number
  byCurrency: MonthlySpendCurrencySummary[]
  upcomingDebts: Debt[]
  upcomingRecurringPayments: RecurringPayment[]
}

export type FinanceCollection = keyof Pick<
  DashboardData,
  'debts' | 'expenses' | 'incomes' | 'investments' | 'goals'
>

export type CreateItemInput =
  | { kind: 'debts'; value: Omit<Debt, 'id' | 'createdAt'> }
  | { kind: 'expenses'; value: Omit<Expense, 'id' | 'createdAt'> }
  | { kind: 'incomes'; value: Omit<Income, 'id' | 'createdAt'> }
  | { kind: 'investments'; value: Omit<Investment, 'id' | 'createdAt'> }
  | { kind: 'goals'; value: Omit<Goal, 'id' | 'createdAt'> }

export interface UpdateDebtInput {
  id: string
  value: Omit<Debt, 'id' | 'createdAt'>
}

export type CreateRecurringPaymentInput = Omit<
  RecurringPayment,
  'id' | 'createdAt'
>

export interface UpdateRecurringPaymentInput {
  id: string
  value: Partial<Omit<RecurringPayment, 'id' | 'createdAt'>>
}

const STORAGE_KEY = 'spends.sh:dashboard:v1'
const DASHBOARD_QUERY_KEY = ['finance-dashboard'] as const
const CONVEX_USER_STORAGE_KEY = 'spends.sh:convex-user-email'

type ConvexDebtDoc = Doc<'debts'>

function getOrCreateConvexUserEmail() {
  if (typeof window === 'undefined') {
    return 'server-preview@spends.local'
  }

  const existing = window.localStorage.getItem(CONVEX_USER_STORAGE_KEY)

  if (existing) {
    return existing
  }

  const generated = `local-${crypto.randomUUID()}@spends.local`
  window.localStorage.setItem(CONVEX_USER_STORAGE_KEY, generated)
  return generated
}

async function getOrCreateConvexUser(
  convex: ReturnType<typeof useConvex>,
  currency = 'USD',
) {
  const email = getOrCreateConvexUserEmail()
  const existing = await convex.query(api.users.getByEmail, { email })

  if (existing) {
    return existing
  }

  await convex.mutation(api.users.create, {
    email,
    name: 'Local spends user',
    currency,
  })

  const created = await convex.query(api.users.getByEmail, { email })

  if (!created) {
    throw new Error('Unable to create Convex user')
  }

  return created
}

function toDebtMutationValue(value: Omit<Debt, 'id' | 'createdAt'>) {
  return {
    name: value.name,
    lender: value.lender,
    type: value.type,
    currency: value.currency,
    balance: value.balance,
    rate: value.rate,
    payments: value.payments,
    ...(value.paymentMode ? { paymentMode: value.paymentMode } : {}),
    ...(typeof value.remainingInstallments === 'number'
      ? { remainingInstallments: value.remainingInstallments }
      : {}),
    ...(typeof value.minimumPayment === 'number'
      ? { minimumPayment: value.minimumPayment }
      : {}),
    ...(typeof value.targetPayment === 'number'
      ? { targetPayment: value.targetPayment }
      : {}),
    ...(typeof value.dueDay === 'number' ? { dueDay: value.dueDay } : {}),
    dueDate: value.dueDate,
    status: value.status ?? 'active',
  }
}

function toDebt(value: ConvexDebtDoc): Debt {
  return {
    id: value._id,
    name: value.name,
    lender: value.lender,
    type: value.type,
    currency: value.currency,
    balance: value.balance,
    rate: value.rate,
    payments: value.payments,
    paymentMode: value.paymentMode,
    remainingInstallments: value.remainingInstallments,
    minimumPayment: value.minimumPayment,
    targetPayment: value.targetPayment,
    dueDay: value.dueDay,
    dueDate: value.dueDate,
    status: value.status,
    createdAt: new Date(value.createdAt).toISOString(),
    updatedAt: new Date(value.updatedAt).toISOString(),
  }
}

function getDefaultDebtPaymentMode(type: DebtType): DebtPaymentMode {
  return type === 'Credit card' ? 'revolving' : 'installments'
}

function normalizeDebtInstallments(value: number) {
  return Math.max(1, Math.round(value))
}

function deriveDebtDueDay(dueDate: string) {
  return new Date(`${dueDate}T00:00:00`).getDate() || 1
}

function buildDebtRecord(
  value: Omit<Debt, 'id' | 'createdAt'>,
  {
    id,
    createdAt,
    updatedAt,
  }: { id: string; createdAt: string; updatedAt?: string },
): Debt {
  const payments = normalizeDebtInstallments(value.payments)

  return {
    ...value,
    id,
    payments,
    paymentMode: value.paymentMode ?? getDefaultDebtPaymentMode(value.type),
    remainingInstallments:
      typeof value.remainingInstallments === 'number'
        ? normalizeDebtInstallments(value.remainingInstallments)
        : payments,
    dueDay:
      typeof value.dueDay === 'number'
        ? Math.max(1, Math.min(31, Math.round(value.dueDay)))
        : deriveDebtDueDay(value.dueDate),
    status: value.status ?? 'active',
    createdAt,
    updatedAt: updatedAt ?? createdAt,
  }
}

function sortDebtsByDueDate(debts: Debt[]) {
  return [...debts].sort(
    (left, right) =>
      +new Date(`${left.dueDate}T00:00:00`) -
      +new Date(`${right.dueDate}T00:00:00`),
  )
}

type FinanceDashboardMutationContext = {
  previousDashboard?: DashboardData
}

async function replaceConvexDebts(
  convex: ReturnType<typeof useConvex>,
  userId: Id<'users'>,
  debts: Debt[],
) {
  const existing = await convex.query(api.debts.listByUser, { userId })

  await Promise.all(
    existing.map((debt) => convex.mutation(api.debts.remove, { id: debt._id })),
  )

  await Promise.all(
    debts.map((debt) =>
      convex.mutation(api.debts.create, {
        userId,
        ...toDebtMutationValue(debt),
      }),
    ),
  )
}

const seedData: DashboardData = {
  debts: [
    {
      id: 'debt-visa',
      name: 'Visa balance',
      lender: 'Mercury Bank',
      type: 'Credit card',
      currency: 'USD',
      balance: 6200,
      rate: 27.9,
      payments: 24,
      dueDate: '2026-03-21',
      createdAt: '2026-03-03T09:00:00.000Z',
    },
    {
      id: 'debt-car',
      name: 'Car loan',
      lender: 'Drive Credit',
      type: 'Loan',
      currency: 'USD',
      balance: 11850,
      rate: 6.4,
      payments: 36,
      dueDate: '2026-03-28',
      createdAt: '2026-02-11T09:00:00.000Z',
    },
    {
      id: 'debt-student',
      name: 'Student loan',
      lender: 'Federal Servicing',
      type: 'Loan',
      currency: 'USD',
      balance: 9300,
      rate: 4.1,
      payments: 48,
      dueDate: '2026-04-06',
      createdAt: '2026-01-16T09:00:00.000Z',
    },
    {
      id: 'debt-mastercard',
      name: 'Mastercard',
      lender: 'Chase Bank',
      type: 'Credit card',
      currency: 'USD',
      balance: 3450,
      rate: 24.5,
      payments: 18,
      dueDate: '2026-03-15',
      createdAt: '2026-02-28T09:00:00.000Z',
    },
    {
      id: 'debt-personal',
      name: 'Personal loan',
      lender: 'Family member',
      type: 'Other',
      currency: 'USD',
      balance: 2800,
      rate: 0,
      payments: 12,
      dueDate: '2026-03-30',
      createdAt: '2026-02-15T09:00:00.000Z',
    },
    {
      id: 'debt-amex',
      name: 'Amex Gold',
      lender: 'American Express',
      type: 'Credit card',
      currency: 'USD',
      balance: 1890,
      rate: 22.8,
      payments: 12,
      dueDate: '2026-03-25',
      createdAt: '2026-02-22T09:00:00.000Z',
    },
    {
      id: 'debt-medical',
      name: 'Medical bill',
      lender: 'Hospital',
      type: 'Other',
      currency: 'USD',
      balance: 4200,
      rate: 0,
      payments: 24,
      dueDate: '2026-04-01',
      createdAt: '2026-01-30T09:00:00.000Z',
    },
    {
      id: 'debt-discover',
      name: 'Discover card',
      lender: 'Discover',
      type: 'Credit card',
      currency: 'USD',
      balance: 2150,
      rate: 19.9,
      payments: 15,
      dueDate: '2026-03-18',
      createdAt: '2026-02-10T09:00:00.000Z',
    },
    {
      id: 'debt-furniture',
      name: 'Furniture financing',
      lender: 'Retail Store',
      type: 'Loan',
      currency: 'USD',
      balance: 1650,
      rate: 0,
      payments: 10,
      dueDate: '2026-03-28',
      createdAt: '2026-02-25T09:00:00.000Z',
    },
    {
      id: 'debt-laptop',
      name: 'Laptop payment plan',
      lender: 'Tech Store',
      type: 'Other',
      currency: 'USD',
      balance: 980,
      rate: 0,
      payments: 6,
      dueDate: '2026-03-20',
      createdAt: '2026-03-01T09:00:00.000Z',
    },
  ],
  expenses: [],
  recurringPayments: [
    {
      id: 'recurring-netflix',
      name: 'Netflix',
      category: 'Subscription',
      amount: 15.99,
      currency: 'USD',
      dueDay: 5,
      status: 'active',
      startDate: '2026-01-15',
      createdAt: '2026-01-15T09:00:00.000Z',
    },
    {
      id: 'recurring-spotify',
      name: 'Spotify',
      category: 'Subscription',
      amount: 10.99,
      currency: 'USD',
      dueDay: 10,
      status: 'active',
      startDate: '2026-01-20',
      createdAt: '2026-01-20T09:00:00.000Z',
    },
    {
      id: 'recurring-gym',
      name: 'Gym membership',
      category: 'Health',
      amount: 45.0,
      currency: 'USD',
      dueDay: 1,
      status: 'active',
      startDate: '2026-01-10',
      createdAt: '2026-01-10T09:00:00.000Z',
    },
    {
      id: 'recurring-internet',
      name: 'Internet',
      category: 'Utilities',
      amount: 79.99,
      currency: 'USD',
      dueDay: 15,
      status: 'active',
      startDate: '2026-01-05',
      createdAt: '2026-01-05T09:00:00.000Z',
    },
    {
      id: 'recurring-phone',
      name: 'Phone plan',
      category: 'Utilities',
      amount: 65.0,
      currency: 'USD',
      dueDay: 20,
      status: 'active',
      startDate: '2026-01-08',
      createdAt: '2026-01-08T09:00:00.000Z',
    },
    {
      id: 'recurring-icloud',
      name: 'iCloud storage',
      category: 'Subscription',
      amount: 2.99,
      currency: 'USD',
      dueDay: 12,
      status: 'active',
      startDate: '2026-01-25',
      createdAt: '2026-01-25T09:00:00.000Z',
    },
    {
      id: 'recurring-insurance',
      name: 'Car insurance',
      category: 'Insurance',
      amount: 125.0,
      currency: 'USD',
      dueDay: 1,
      status: 'active',
      startDate: '2026-01-03',
      createdAt: '2026-01-03T09:00:00.000Z',
    },
    {
      id: 'recurring-dropbox',
      name: 'Dropbox',
      category: 'Subscription',
      amount: 11.99,
      currency: 'USD',
      dueDay: 8,
      status: 'active',
      startDate: '2026-02-01',
      createdAt: '2026-02-01T09:00:00.000Z',
    },
    {
      id: 'recurring-amazon',
      name: 'Amazon Prime',
      category: 'Subscription',
      amount: 14.99,
      currency: 'USD',
      dueDay: 25,
      status: 'active',
      startDate: '2026-01-12',
      createdAt: '2026-01-12T09:00:00.000Z',
    },
    {
      id: 'recurring-hulu',
      name: 'Hulu',
      category: 'Subscription',
      amount: 7.99,
      currency: 'USD',
      dueDay: 18,
      status: 'active',
      startDate: '2026-02-05',
      createdAt: '2026-02-05T09:00:00.000Z',
    },
  ],
  incomes: [
    {
      id: 'income-salary',
      name: 'Studio salary',
      source: 'Northline Studio',
      amount: 3200,
      frequency: 'Monthly',
      nextDate: '2026-03-31',
      createdAt: '2026-01-05T09:00:00.000Z',
    },
    {
      id: 'income-freelance',
      name: 'Freelance retainer',
      source: 'Acme Labs',
      amount: 950,
      frequency: 'Monthly',
      nextDate: '2026-03-25',
      createdAt: '2026-02-02T09:00:00.000Z',
    },
    {
      id: 'income-dividend',
      name: 'Dividend sweep',
      source: 'Brokerage',
      amount: 180,
      frequency: 'Quarterly',
      nextDate: '2026-04-15',
      createdAt: '2026-02-26T09:00:00.000Z',
    },
  ],
  investments: [
    {
      id: 'investment-brokerage',
      name: 'Core ETF basket',
      account: 'Brokerage',
      type: 'ETF',
      currentValue: 14850,
      monthlyContribution: 350,
      changePct: 6.8,
      createdAt: '2026-01-10T09:00:00.000Z',
    },
    {
      id: 'investment-retirement',
      name: '401(k)',
      account: 'Employer plan',
      type: 'Retirement',
      currentValue: 31200,
      monthlyContribution: 420,
      changePct: 8.2,
      createdAt: '2026-01-07T09:00:00.000Z',
    },
    {
      id: 'investment-crypto',
      name: 'Crypto side bag',
      account: 'Exchange',
      type: 'Crypto',
      currentValue: 2200,
      monthlyContribution: 60,
      changePct: -2.5,
      createdAt: '2026-02-14T09:00:00.000Z',
    },
  ],
  goals: [
    {
      id: 'goal-emergency',
      name: 'Emergency cushion',
      type: 'Emergency',
      target: 12000,
      current: 7200,
      deadline: '2026-08-01',
      createdAt: '2026-01-09T09:00:00.000Z',
    },
    {
      id: 'goal-visa',
      name: 'Visa payoff sprint',
      type: 'Debt payoff',
      target: 6200,
      current: 1700,
      deadline: '2026-07-15',
      createdAt: '2026-02-20T09:00:00.000Z',
    },
    {
      id: 'goal-ira',
      name: 'Roth IRA target',
      type: 'Investment',
      target: 7000,
      current: 2600,
      deadline: '2026-12-20',
      createdAt: '2026-01-21T09:00:00.000Z',
    },
  ],
  settings: {
    currency: 'USD',
    lastUpdated: '2026-03-10T16:00:00.000Z',
  },
}

const seedDebtIds = new Set(seedData.debts.map((item) => item.id))
const seedExpenseIds = new Set(seedData.expenses.map((item) => item.id))
const seedIncomeIds = new Set(seedData.incomes.map((item) => item.id))
const seedInvestmentIds = new Set(seedData.investments.map((item) => item.id))
const seedGoalIds = new Set(seedData.goals.map((item) => item.id))

function cloneDashboardData(data: DashboardData): DashboardData {
  return JSON.parse(JSON.stringify(data)) as DashboardData
}

function emptyDashboardData(currency = 'USD'): DashboardData {
  return {
    debts: [],
    expenses: [],
    incomes: [],
    investments: [],
    goals: [],
    recurringPayments: [],
    settings: {
      currency,
      lastUpdated: new Date().toISOString(),
    },
  }
}

function normalizeDashboardData(input: unknown): DashboardData {
  const fallback = cloneDashboardData(seedData)

  if (!input || typeof input !== 'object') {
    return fallback
  }

  const value = input as Partial<DashboardData>

  return {
    debts: Array.isArray(value.debts)
      ? value.debts.map((debt) => ({
          ...debt,
          currency:
            typeof debt.currency === 'string' && debt.currency
              ? debt.currency
              : fallback.settings.currency,
          payments:
            typeof (debt as any).payments === 'number'
              ? (debt as any).payments
              : 1,
          paymentMode:
            debt.paymentMode === 'revolving' ||
            debt.paymentMode === 'installments'
              ? debt.paymentMode
              : debt.type === 'Credit card'
                ? 'revolving'
                : 'installments',
          remainingInstallments:
            typeof debt.remainingInstallments === 'number'
              ? debt.remainingInstallments
              : typeof (debt as any).payments === 'number'
                ? Math.max(1, Math.round((debt as any).payments))
                : 1,
          dueDay:
            typeof debt.dueDay === 'number'
              ? Math.max(1, Math.min(31, Math.round(debt.dueDay)))
              : new Date(`${debt.dueDate}T00:00:00`).getDate() || 1,
          status: debt.status === 'closed' ? 'closed' : 'active',
          updatedAt:
            typeof debt.updatedAt === 'string'
              ? debt.updatedAt
              : debt.createdAt,
        }))
      : fallback.debts,
    expenses: Array.isArray(value.expenses)
      ? value.expenses.map((expense) => ({
          ...expense,
          currency:
            typeof expense.currency === 'string' && expense.currency
              ? expense.currency
              : fallback.settings.currency,
          spentAt:
            typeof expense.spentAt === 'string' && expense.spentAt
              ? expense.spentAt
              : typeof expense.createdAt === 'string' && expense.createdAt
                ? expense.createdAt.slice(0, 10)
                : new Date().toISOString().slice(0, 10),
          updatedAt:
            typeof expense.updatedAt === 'string'
              ? expense.updatedAt
              : expense.createdAt,
        }))
      : fallback.expenses,
    incomes: Array.isArray(value.incomes) ? value.incomes : fallback.incomes,
    investments: Array.isArray(value.investments)
      ? value.investments
      : fallback.investments,
    goals: Array.isArray(value.goals) ? value.goals : fallback.goals,
    recurringPayments: Array.isArray(value.recurringPayments)
      ? value.recurringPayments.map((payment) => ({
          ...payment,
          currency:
            typeof payment.currency === 'string' && payment.currency
              ? payment.currency
              : fallback.settings.currency,
          dueDay:
            typeof payment.dueDay === 'number'
              ? Math.max(1, Math.min(31, Math.round(payment.dueDay)))
              : 1,
          status:
            payment.status === 'paused' || payment.status === 'cancelled'
              ? payment.status
              : 'active',
          startDate:
            typeof payment.startDate === 'string' && payment.startDate
              ? payment.startDate
              : typeof payment.createdAt === 'string' && payment.createdAt
                ? payment.createdAt.slice(0, 10)
                : new Date().toISOString().slice(0, 10),
          cadence: 'monthly',
          updatedAt:
            typeof payment.updatedAt === 'string'
              ? payment.updatedAt
              : typeof payment.createdAt === 'string'
                ? payment.createdAt
                : new Date().toISOString(),
        }))
      : fallback.recurringPayments,
    settings: {
      currency:
        typeof value.settings?.currency === 'string'
          ? value.settings.currency
          : fallback.settings.currency,
      lastUpdated:
        typeof value.settings?.lastUpdated === 'string'
          ? value.settings.lastUpdated
          : fallback.settings.lastUpdated,
    },
  }
}

async function readDashboardData(): Promise<DashboardData> {
  if (typeof window === 'undefined') {
    return cloneDashboardData(seedData)
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)

  if (!raw) {
    return cloneDashboardData(seedData)
  }

  try {
    return normalizeDashboardData(JSON.parse(raw))
  } catch {
    return cloneDashboardData(seedData)
  }
}

async function writeDashboardData(data: DashboardData): Promise<DashboardData> {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }

  return data
}

async function updateDashboardData(
  updater: (current: DashboardData) => DashboardData,
): Promise<DashboardData> {
  const current = await readDashboardData()
  const next = updater(current)

  return writeDashboardData({
    ...next,
    settings: {
      ...next.settings,
      lastUpdated: new Date().toISOString(),
    },
  })
}

function createId(prefix: string) {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

export function useFinanceDashboard(enabled = true) {
  const convex = useConvex()

  return useQuery({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: async () => {
      const localData = await readDashboardData()
      const user = await getOrCreateConvexUser(
        convex,
        localData.settings.currency,
      )
      let convexDebts = await convex.query(api.debts.listByUser, {
        userId: user._id,
      })

      if (!convexDebts.length && localData.debts.length) {
        await Promise.all(
          localData.debts.map((debt) =>
            convex.mutation(api.debts.create, {
              userId: user._id,
              ...toDebtMutationValue(debt),
            }),
          ),
        )

        convexDebts = await convex.query(api.debts.listByUser, {
          userId: user._id,
        })
      }

      return {
        ...localData,
        debts: convexDebts.map(toDebt),
      }
    },
    enabled,
    staleTime: 0,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
  })
}

export function useFinanceActions() {
  const convex = useConvex()
  const queryClient = useQueryClient()

  const syncCache = (next: DashboardData) => {
    queryClient.setQueryData(DASHBOARD_QUERY_KEY, next)
  }

  const createItemMutation = useMutation({
    mutationFn: async (input: CreateItemInput) => {
      if (input.kind === 'debts') {
        const localData = await readDashboardData()
        const user = await getOrCreateConvexUser(
          convex,
          localData.settings.currency,
        )

        await convex.mutation(api.debts.create, {
          userId: user._id,
          ...toDebtMutationValue(input.value),
        })

        return null
      }

      return updateDashboardData((current) => {
        const createdAt = new Date().toISOString()

        switch (input.kind) {
          case 'expenses':
            return {
              ...current,
              expenses: [
                {
                  ...input.value,
                  id: createId('expense'),
                  createdAt,
                  updatedAt: createdAt,
                },
                ...current.expenses,
              ],
            }
          case 'incomes':
            return {
              ...current,
              incomes: [
                {
                  ...input.value,
                  id: createId('income'),
                  createdAt,
                },
                ...current.incomes,
              ],
            }
          case 'investments':
            return {
              ...current,
              investments: [
                {
                  ...input.value,
                  id: createId('investment'),
                  createdAt,
                },
                ...current.investments,
              ],
            }
          case 'goals':
            return {
              ...current,
              goals: [
                {
                  ...input.value,
                  id: createId('goal'),
                  createdAt,
                },
                ...current.goals,
              ],
            }
        }
      })
    },
    onMutate: async (input): Promise<FinanceDashboardMutationContext> => {
      if (input.kind !== 'debts') {
        return {}
      }

      await queryClient.cancelQueries({ queryKey: DASHBOARD_QUERY_KEY })

      const previousDashboard =
        queryClient.getQueryData<DashboardData>(DASHBOARD_QUERY_KEY)

      if (!previousDashboard) {
        return {}
      }

      const createdAt = new Date().toISOString()
      const optimisticDebt = buildDebtRecord(input.value, {
        id: createId('debt'),
        createdAt,
      })

      syncCache({
        ...previousDashboard,
        debts: sortDebtsByDueDate([optimisticDebt, ...previousDashboard.debts]),
      })

      return { previousDashboard }
    },
    onError: (_error, _input, context) => {
      if (context?.previousDashboard) {
        syncCache(context.previousDashboard)
      }
    },
    onSuccess: (next) => {
      if (next) {
        syncCache(next)
      }
    },
    onSettled: (_data, _error, input) => {
      if (input.kind === 'debts') {
        void queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY })
      }
    },
  })

  const removeItemMutation = useMutation({
    mutationFn: async ({
      kind,
      id,
    }: {
      kind: FinanceCollection
      id: string
    }) => {
      if (kind === 'debts') {
        await convex.mutation(api.debts.remove, { id: id as Id<'debts'> })
        return null
      }

      return updateDashboardData((current) => ({
        ...current,
        [kind]: current[kind].filter((item) => item.id !== id),
      }))
    },
    onSuccess: (next, { kind }) => {
      if (kind === 'debts') {
        void queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY })
        return
      }

      if (next) {
        syncCache(next)
      }
    },
  })

  const updateDebtMutation = useMutation({
    mutationFn: async ({ id, value }: UpdateDebtInput) => {
      await convex.mutation(api.debts.update, {
        id: id as Id<'debts'>,
        ...toDebtMutationValue(value),
      })
      return null
    },
    onMutate: async ({
      id,
      value,
    }): Promise<FinanceDashboardMutationContext> => {
      await queryClient.cancelQueries({ queryKey: DASHBOARD_QUERY_KEY })

      const previousDashboard =
        queryClient.getQueryData<DashboardData>(DASHBOARD_QUERY_KEY)

      if (!previousDashboard) {
        return {}
      }

      const updatedAt = new Date().toISOString()

      syncCache({
        ...previousDashboard,
        debts: sortDebtsByDueDate(
          previousDashboard.debts.map((debt) =>
            debt.id === id
              ? buildDebtRecord(
                  { ...debt, ...value, updatedAt },
                  {
                    id: debt.id,
                    createdAt: debt.createdAt,
                    updatedAt,
                  },
                )
              : debt,
          ),
        ),
      })

      return { previousDashboard }
    },
    onError: (_error, _input, context) => {
      if (context?.previousDashboard) {
        syncCache(context.previousDashboard)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY })
    },
  })

  const createRecurringPaymentMutation = useMutation({
    mutationFn: async (input: CreateRecurringPaymentInput) => {
      return updateDashboardData((current) => ({
        ...current,
        recurringPayments: [
          {
            ...input,
            id: createId('recurring'),
            cadence: 'monthly',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          ...current.recurringPayments,
        ],
      }))
    },
    onSuccess: syncCache,
  })

  const updateRecurringPaymentMutation = useMutation({
    mutationFn: async ({ id, value }: UpdateRecurringPaymentInput) => {
      return updateDashboardData((current) => ({
        ...current,
        recurringPayments: current.recurringPayments.map((p) =>
          p.id === id
            ? { ...p, ...value, updatedAt: new Date().toISOString() }
            : p,
        ),
      }))
    },
    onSuccess: syncCache,
  })

  const removeRecurringPaymentMutation = useMutation({
    mutationFn: async (id: string) => {
      return updateDashboardData((current) => ({
        ...current,
        recurringPayments: current.recurringPayments.filter((p) => p.id !== id),
      }))
    },
    onSuccess: syncCache,
  })

  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: Partial<DashboardSettings>) => {
      return updateDashboardData((current) => ({
        ...current,
        settings: {
          ...current.settings,
          ...settings,
        },
      }))
    },
    onSuccess: syncCache,
  })

  const resetDemoDataMutation = useMutation({
    mutationFn: async () => {
      const next = cloneDashboardData(seedData)
      const user = await getOrCreateConvexUser(convex, next.settings.currency)
      await replaceConvexDebts(convex, user._id, next.debts)
      return writeDashboardData(next)
    },
    onSuccess: (next) => {
      syncCache(next)
      void queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY })
    },
  })

  const clearDashboardMutation = useMutation({
    mutationFn: async (currency: string) => {
      const next = emptyDashboardData(currency)
      const user = await getOrCreateConvexUser(convex, currency)
      await replaceConvexDebts(convex, user._id, [])
      return writeDashboardData(next)
    },
    onSuccess: (next) => {
      syncCache(next)
      void queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY })
    },
  })

  return useMemo(
    () => ({
      createItem: createItemMutation.mutateAsync,
      removeItem: removeItemMutation.mutateAsync,
      updateDebt: updateDebtMutation.mutateAsync,
      createRecurringPayment: createRecurringPaymentMutation.mutateAsync,
      updateRecurringPayment: updateRecurringPaymentMutation.mutateAsync,
      removeRecurringPayment: removeRecurringPaymentMutation.mutateAsync,
      updateSettings: updateSettingsMutation.mutateAsync,
      resetDemoData: resetDemoDataMutation.mutateAsync,
      clearDashboard: clearDashboardMutation.mutateAsync,
      isWorking:
        createItemMutation.isPending ||
        removeItemMutation.isPending ||
        updateDebtMutation.isPending ||
        createRecurringPaymentMutation.isPending ||
        updateRecurringPaymentMutation.isPending ||
        removeRecurringPaymentMutation.isPending ||
        updateSettingsMutation.isPending ||
        resetDemoDataMutation.isPending ||
        clearDashboardMutation.isPending,
    }),
    [
      clearDashboardMutation.isPending,
      clearDashboardMutation.mutateAsync,
      createItemMutation.isPending,
      createItemMutation.mutateAsync,
      createRecurringPaymentMutation.isPending,
      createRecurringPaymentMutation.mutateAsync,
      removeItemMutation.isPending,
      removeItemMutation.mutateAsync,
      removeRecurringPaymentMutation.isPending,
      removeRecurringPaymentMutation.mutateAsync,
      resetDemoDataMutation.isPending,
      resetDemoDataMutation.mutateAsync,
      updateDebtMutation.isPending,
      updateDebtMutation.mutateAsync,
      updateRecurringPaymentMutation.isPending,
      updateRecurringPaymentMutation.mutateAsync,
      updateSettingsMutation.isPending,
      updateSettingsMutation.mutateAsync,
    ],
  )
}

export function formatCurrency(value: number, currency = 'USD') {
  if (currency.toUpperCase() === 'PEN') {
    const absoluteValue = Math.abs(value)
    const sign = value < 0 ? '-' : ''
    const formattedValue = new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
    }).format(absoluteValue)

    return `${sign}S/. ${formattedValue}`
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatCompactCurrency(value: number, currency = 'USD') {
  if (currency.toUpperCase() === 'PEN') {
    const absoluteValue = Math.abs(value)
    const sign = value < 0 ? '-' : ''
    const formattedValue = new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(absoluteValue)

    return `${sign}S/. ${formattedValue}`
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

export function formatPercent(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

export function getMonthlyIncomeAmount(income: Income) {
  switch (income.frequency) {
    case 'Weekly':
      return (income.amount * 52) / 12
    case 'Biweekly':
      return (income.amount * 26) / 12
    case 'Monthly':
      return income.amount
    case 'Quarterly':
      return income.amount / 3
    case 'Yearly':
      return income.amount / 12
    case 'One-time':
      return income.amount
  }
}

export function getDebtMonthlyPayment(balance: number, payments: number) {
  return balance / Math.max(1, payments)
}

export function getDebtPlannedPayment(
  debt: Pick<
    Debt,
    'balance' | 'payments' | 'minimumPayment' | 'targetPayment' | 'status'
  >,
) {
  if (debt.status === 'closed') {
    return 0
  }

  if (typeof debt.targetPayment === 'number' && debt.targetPayment > 0) {
    return debt.targetPayment
  }

  if (typeof debt.minimumPayment === 'number' && debt.minimumPayment > 0) {
    return debt.minimumPayment
  }

  return getDebtMonthlyPayment(debt.balance, debt.payments)
}

function getMonthRange(month: string) {
  const [yearText, monthText] = month.split('-')
  const year = Number(yearText)
  const monthIndex = Number(monthText)

  if (!Number.isInteger(year) || !Number.isInteger(monthIndex)) {
    throw new Error('month must use YYYY-MM format')
  }

  const startDate = `${yearText}-${monthText}-01`
  const endDate = new Date(Date.UTC(year, monthIndex, 0))
    .toISOString()
    .slice(0, 10)

  return { startDate, endDate }
}

function isRecurringActiveInMonth(
  payment: Pick<RecurringPayment, 'startDate'> & { endDate?: string },
  startDate: string,
  endDate: string,
) {
  return (
    payment.startDate <= endDate &&
    (!payment.endDate || payment.endDate >= startDate)
  )
}

export function getMonthlySpendSummary(
  data: DashboardData,
  month: string,
  currency?: string,
): MonthlySpendSummary {
  const { startDate, endDate } = getMonthRange(month)
  const debtItems = data.debts.filter(
    (debt) =>
      debt.status !== 'closed' && (!currency || debt.currency === currency),
  )
  const recurringItems = data.recurringPayments.filter(
    (payment) =>
      payment.status === 'active' &&
      (!currency || payment.currency === currency) &&
      isRecurringActiveInMonth(payment, startDate, endDate),
  )
  const expenseItems = data.expenses.filter(
    (expense) =>
      expense.spentAt >= startDate &&
      expense.spentAt <= endDate &&
      (!currency || expense.currency === currency),
  )

  const plannedDebtPayments = debtItems.reduce(
    (sum, debt) => sum + getDebtPlannedPayment(debt),
    0,
  )
  const plannedRecurringPayments = recurringItems.reduce(
    (sum, payment) => sum + payment.amount,
    0,
  )
  const actualExpenses = expenseItems.reduce(
    (sum, expense) => sum + expense.amount,
    0,
  )

  const byCurrency = new Map<string, MonthlySpendCurrencySummary>()

  for (const debt of debtItems) {
    const current = byCurrency.get(debt.currency) ?? {
      currency: debt.currency,
      plannedDebtPayments: 0,
      plannedRecurringPayments: 0,
      actualExpenses: 0,
      totalMonthlySpend: 0,
    }
    current.plannedDebtPayments += getDebtPlannedPayment(debt)
    current.totalMonthlySpend += getDebtPlannedPayment(debt)
    byCurrency.set(debt.currency, current)
  }

  for (const payment of recurringItems) {
    const current = byCurrency.get(payment.currency) ?? {
      currency: payment.currency,
      plannedDebtPayments: 0,
      plannedRecurringPayments: 0,
      actualExpenses: 0,
      totalMonthlySpend: 0,
    }
    current.plannedRecurringPayments += payment.amount
    current.totalMonthlySpend += payment.amount
    byCurrency.set(payment.currency, current)
  }

  for (const expense of expenseItems) {
    const current = byCurrency.get(expense.currency) ?? {
      currency: expense.currency,
      plannedDebtPayments: 0,
      plannedRecurringPayments: 0,
      actualExpenses: 0,
      totalMonthlySpend: 0,
    }
    current.actualExpenses += expense.amount
    current.totalMonthlySpend += expense.amount
    byCurrency.set(expense.currency, current)
  }

  return {
    month,
    plannedDebtPayments,
    plannedRecurringPayments,
    actualExpenses,
    totalMonthlySpend:
      plannedDebtPayments + plannedRecurringPayments + actualExpenses,
    byCurrency: [...byCurrency.values()].sort((left, right) =>
      left.currency.localeCompare(right.currency),
    ),
    upcomingDebts: debtItems
      .filter((debt) => debt.dueDate >= startDate && debt.dueDate <= endDate)
      .sort((left, right) => left.dueDate.localeCompare(right.dueDate)),
    upcomingRecurringPayments: recurringItems
      .slice()
      .sort((left, right) => left.dueDay - right.dueDay),
  }
}

export function getDashboardSummary(data: DashboardData) {
  const totalDebt = data.debts.reduce((sum, debt) => sum + debt.balance, 0)
  const monthlyIncome = data.incomes.reduce(
    (sum, income) => sum + getMonthlyIncomeAmount(income),
    0,
  )
  const totalInvestments = data.investments.reduce(
    (sum, investment) => sum + investment.currentValue,
    0,
  )
  const totalGoalCurrent = data.goals.reduce(
    (sum, goal) => sum + goal.current,
    0,
  )
  const totalGoalTarget = data.goals.reduce((sum, goal) => sum + goal.target, 0)
  const totalMinimums = data.debts.reduce(
    (sum, debt) => sum + getDebtPlannedPayment(debt),
    0,
  )
  const monthlyInvesting = data.investments.reduce(
    (sum, investment) => sum + investment.monthlyContribution,
    0,
  )

  return {
    totalDebt,
    monthlyIncome,
    totalInvestments,
    totalGoalCurrent,
    totalGoalTarget,
    totalMinimums,
    monthlyInvesting,
    netPosition: totalInvestments - totalDebt,
    goalProgress:
      totalGoalTarget > 0 ? (totalGoalCurrent / totalGoalTarget) * 100 : 0,
    freeCash: monthlyIncome - totalMinimums - monthlyInvesting,
  }
}

export function getDebtMonthlyTotalsByCurrency(debts: Debt[]) {
  const totals = new Map<string, number>()

  debts.forEach((debt) => {
    const current = totals.get(debt.currency) ?? 0
    totals.set(debt.currency, current + getDebtPlannedPayment(debt))
  })

  return [...totals.entries()]
    .map(([currency, total]) => ({ currency, total }))
    .sort((left, right) => left.currency.localeCompare(right.currency))
}

export function getRecentEntries(data: DashboardData): RecentEntry[] {
  return [
    ...data.debts.map((item) => ({
      id: item.id,
      label: item.name,
      kind: 'Debt' as const,
      meta: item.lender,
      amount: item.balance,
      createdAt: item.createdAt,
    })),
    ...data.incomes.map((item) => ({
      id: item.id,
      label: item.name,
      kind: 'Income' as const,
      meta: item.source,
      amount: item.amount,
      createdAt: item.createdAt,
    })),
    ...data.investments.map((item) => ({
      id: item.id,
      label: item.name,
      kind: 'Investment' as const,
      meta: item.account,
      amount: item.currentValue,
      createdAt: item.createdAt,
    })),
    ...data.goals.map((item) => ({
      id: item.id,
      label: item.name,
      kind: 'Goal' as const,
      meta: item.type,
      amount: item.target,
      createdAt: item.createdAt,
    })),
  ]
    .sort(
      (left, right) => +new Date(right.createdAt) - +new Date(left.createdAt),
    )
    .slice(0, 6)
}

export function getSoonestDate(values: string[]) {
  if (!values.length) {
    return null
  }

  return [...values].sort(
    (left, right) => +new Date(left) - +new Date(right),
  )[0]
}

export function getAverageRate(debts: Debt[]) {
  if (!debts.length) {
    return 0
  }

  return debts.reduce((sum, debt) => sum + debt.rate, 0) / debts.length
}

export function getAverageInvestmentChange(investments: Investment[]) {
  if (!investments.length) {
    return 0
  }

  return (
    investments.reduce((sum, investment) => sum + investment.changePct, 0) /
    investments.length
  )
}

export function isSeedDataActive(data: DashboardData) {
  return (
    data.debts.length === seedData.debts.length &&
    data.expenses.length === seedData.expenses.length &&
    data.incomes.length === seedData.incomes.length &&
    data.investments.length === seedData.investments.length &&
    data.goals.length === seedData.goals.length &&
    data.debts.every((item) => seedDebtIds.has(item.id)) &&
    data.expenses.every((item) => seedExpenseIds.has(item.id)) &&
    data.incomes.every((item) => seedIncomeIds.has(item.id)) &&
    data.investments.every((item) => seedInvestmentIds.has(item.id)) &&
    data.goals.every((item) => seedGoalIds.has(item.id))
  )
}

export function getDebtProjection(
  debts: Debt[],
  startDate = new Date(),
  maxMonths = 72,
): DebtProjectionPoint[] {
  const activeDebts = debts
    .filter((debt) => debt.balance > 0 && debt.status !== 'closed')
    .map((debt) => ({
      balance: debt.balance,
      rate: debt.rate / 100 / 12,
      payments: debt.payments,
      monthlyPrincipal: getDebtPlannedPayment(debt),
    }))

  if (!activeDebts.length) {
    return []
  }

  const totalBalance = () =>
    activeDebts.reduce((sum, debt) => sum + Math.max(debt.balance, 0), 0)

  const points: DebtProjectionPoint[] = [
    {
      monthIndex: 0,
      label: 'Now',
      balance: totalBalance(),
    },
  ]

  for (let monthIndex = 1; monthIndex <= maxMonths; monthIndex++) {
    activeDebts.forEach((debt) => {
      if (debt.balance <= 0) {
        return
      }

      const interest = debt.balance * debt.rate
      const expectedPayment = debt.monthlyPrincipal + interest
      const payment = Math.min(debt.balance + interest, expectedPayment)

      debt.balance = Math.max(debt.balance + interest - payment, 0)
    })

    const pointDate = new Date(startDate)
    pointDate.setMonth(pointDate.getMonth() + monthIndex)

    points.push({
      monthIndex,
      label: pointDate.toLocaleDateString('en-US', { month: 'short' }),
      balance: totalBalance(),
    })

    if (points.at(-1)?.balance === 0) {
      break
    }
  }

  return points
}

export function getDebtMonthlyPlan(
  debts: Debt[],
  monthlyBudget: number,
  startDate = new Date(),
  maxMonths = 72,
): DebtMonthPlanRow[] {
  const activeDebts = debts
    .filter((debt) => debt.balance > 0 && debt.status !== 'closed')
    .map((debt) => ({
      id: debt.id,
      name: debt.name,
      balance: debt.balance,
      rate: debt.rate / 100 / 12,
      payments: debt.payments,
      monthlyPrincipal: getDebtPlannedPayment(debt),
    }))

  if (!activeDebts.length) {
    return []
  }

  const rows: DebtMonthPlanRow[] = []

  for (let monthIndex = 0; monthIndex < maxMonths; monthIndex++) {
    const pointDate = new Date(startDate)
    pointDate.setMonth(pointDate.getMonth() + monthIndex)

    const monthState = activeDebts
      .filter((debt) => debt.balance > 0)
      .map((debt) => {
        const interest = debt.balance * debt.rate
        const balanceWithInterest = debt.balance + interest
        const expectedPayment = debt.monthlyPrincipal + interest
        const minDue = Math.min(expectedPayment, balanceWithInterest)

        return {
          ...debt,
          interest,
          balanceWithInterest,
          minDue,
          payment: 0,
        }
      })

    if (!monthState.length) {
      break
    }

    const totalMinDue = monthState.reduce((sum, debt) => sum + debt.minDue, 0)
    let paymentPool = Math.max(monthlyBudget, totalMinDue)

    monthState.forEach((debt) => {
      const payment = Math.min(paymentPool, debt.minDue)
      debt.payment += payment
      debt.balanceWithInterest -= payment
      paymentPool -= payment
    })

    while (paymentPool > 0) {
      const target = monthState
        .filter((debt) => debt.balanceWithInterest > 0)
        .sort(
          (left, right) =>
            right.rate - left.rate || left.id.localeCompare(right.id),
        )
        .at(0)

      if (!target) {
        break
      }

      const extra = Math.min(paymentPool, target.balanceWithInterest)
      target.payment += extra
      target.balanceWithInterest -= extra
      paymentPool -= extra
    }

    monthState.forEach((state) => {
      const debt = activeDebts.find((item) => item.id === state.id)

      if (debt) {
        debt.balance = Math.max(state.balanceWithInterest, 0)
      }
    })

    const totalPayment = monthState.reduce((sum, debt) => sum + debt.payment, 0)
    const interest = monthState.reduce((sum, debt) => sum + debt.interest, 0)
    const endingBalance = activeDebts.reduce(
      (sum, debt) => sum + Math.max(debt.balance, 0),
      0,
    )

    const items = monthState.map((state) => {
      const debt = activeDebts.find((d) => d.id === state.id)
      return {
        id: state.id,
        name: state.name || state.id,
        payment: state.payment,
        interest: state.interest,
        principal: Math.max(state.payment - state.interest, 0),
        endingBalance: debt?.balance || 0,
      }
    })

    rows.push({
      monthIndex,
      label:
        monthIndex === 0
          ? 'This month'
          : pointDate.toLocaleDateString('en-US', {
              month: 'short',
              year: '2-digit',
            }),
      totalPayment,
      interest,
      principal: Math.max(totalPayment - interest, 0),
      endingBalance,
      debts: items,
    })

    if (endingBalance <= 0) {
      break
    }
  }

  return rows
}
