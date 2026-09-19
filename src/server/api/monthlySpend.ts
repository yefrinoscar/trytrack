import { and, eq, gte, lte } from 'drizzle-orm'
import { getDb } from '../db/client'
import { debts, expenses, recurringPayments } from '../db/schema'
import { toDoc } from '../db/serialize'

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

function isInCurrency(currency: string, selectedCurrency?: string) {
  return !selectedCurrency || currency === selectedCurrency
}

function getDebtPlannedPayment(debt: {
  balance: number
  payments: number
  remainingInstallments?: number | null
  minimumPayment?: number | null
  targetPayment?: number | null
}) {
  if (typeof debt.targetPayment === 'number' && debt.targetPayment > 0) {
    return debt.targetPayment
  }

  if (typeof debt.minimumPayment === 'number' && debt.minimumPayment > 0) {
    return debt.minimumPayment
  }

  return debt.balance / Math.max(1, debt.remainingInstallments ?? debt.payments)
}

function isRecurringActiveInMonth(
  recurringPayment: { startDate: string; endDate?: string | null },
  startDate: string,
  endDate: string,
) {
  return (
    recurringPayment.startDate <= endDate &&
    (!recurringPayment.endDate || recurringPayment.endDate >= startDate)
  )
}

export async function getMonthlySpendSummary(args: {
  userId: string
  month: string
  currency?: string
}) {
  const db = await getDb()
  const { startDate, endDate } = getMonthRange(args.month)

  const [debtRows, recurringRows, expenseRows] = await Promise.all([
    db
      .select()
      .from(debts)
      .where(and(eq(debts.userId, args.userId), eq(debts.status, 'active')))
      .limit(250),
    db
      .select()
      .from(recurringPayments)
      .where(
        and(
          eq(recurringPayments.userId, args.userId),
          eq(recurringPayments.status, 'active'),
        ),
      )
      .limit(250),
    db
      .select()
      .from(expenses)
      .where(
        and(
          eq(expenses.userId, args.userId),
          gte(expenses.spentAt, startDate),
          lte(expenses.spentAt, endDate),
        ),
      )
      .limit(500),
  ])

  const debtItems = debtRows.filter((debt) =>
    isInCurrency(debt.currency, args.currency),
  )
  const recurringItems = recurringRows.filter(
    (payment) =>
      isInCurrency(payment.currency, args.currency) &&
      isRecurringActiveInMonth(payment, startDate, endDate),
  )
  const expenseItems = expenseRows.filter((expense) =>
    isInCurrency(expense.currency, args.currency),
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

  const byCurrencyMap = new Map<
    string,
    {
      plannedDebtPayments: number
      plannedRecurringPayments: number
      actualExpenses: number
    }
  >()

  const ensure = (currency: string) => {
    const current = byCurrencyMap.get(currency) ?? {
      plannedDebtPayments: 0,
      plannedRecurringPayments: 0,
      actualExpenses: 0,
    }
    byCurrencyMap.set(currency, current)
    return current
  }

  for (const debt of debtItems) {
    ensure(debt.currency).plannedDebtPayments += getDebtPlannedPayment(debt)
  }
  for (const payment of recurringItems) {
    ensure(payment.currency).plannedRecurringPayments += payment.amount
  }
  for (const expense of expenseItems) {
    ensure(expense.currency).actualExpenses += expense.amount
  }

  return {
    month: args.month,
    plannedDebtPayments,
    plannedRecurringPayments,
    actualExpenses,
    totalMonthlySpend:
      plannedDebtPayments + plannedRecurringPayments + actualExpenses,
    byCurrency: [...byCurrencyMap.entries()]
      .map(([currency, totals]) => ({
        currency,
        ...totals,
        totalMonthlySpend:
          totals.plannedDebtPayments +
          totals.plannedRecurringPayments +
          totals.actualExpenses,
      }))
      .sort((left, right) => left.currency.localeCompare(right.currency)),
    upcomingDebts: debtItems
      .filter((debt) => debt.dueDate >= startDate && debt.dueDate <= endDate)
      .sort((left, right) => left.dueDate.localeCompare(right.dueDate))
      .slice(0, 10)
      .map(toDoc),
    upcomingRecurringPayments: recurringItems
      .sort((left, right) => left.dueDay - right.dueDay)
      .slice(0, 10)
      .map(toDoc),
  }
}
