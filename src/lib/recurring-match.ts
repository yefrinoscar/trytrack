import { convertCurrency } from './finance'
import type { Expense, RecurringPayment } from './finance'

/**
 * Works out whether a recurring payment looks already paid, by matching it
 * against the expenses that were imported or recorded.
 *
 * Detection is computed on the fly rather than stored, so it stays correct
 * when an expense is added, edited or deleted. A manual mark still wins, which
 * matters for charges that never produce a matching expense.
 */

function normalize(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** How far from the due day an amount-only match may land. */
const AMOUNT_MATCH_WINDOW_DAYS = 10

export type RecurringMatch = {
  expense: Expense
  /** Why it matched, for a truthful tooltip. */
  reason: 'name' | 'amount'
}

export function findRecurringMatch(
  payment: RecurringPayment,
  expenses: Expense[],
  month: string,
  usdPenRate: number,
): RecurringMatch | null {
  const paymentCurrency = payment.currency.toUpperCase()
  const paymentCents = Math.round(payment.amount * 100)
  const name = normalize(payment.name)
  const dueDay = Math.round(payment.dueDay)

  const inMonth = expenses.filter((expense) =>
    expense.spentAt.startsWith(month),
  )

  // 1. Name match: the most trustworthy signal.
  if (name.length >= 4) {
    const byName = inMonth.find((expense) => {
      const haystack = normalize(
        `${expense.description} ${expense.merchant ?? ''}`,
      )
      return (
        haystack.length > 0 &&
        (haystack.includes(name) || name.includes(haystack))
      )
    })

    if (byName) {
      return { expense: byName, reason: 'name' }
    }
  }

  // 2. Amount match near the due day, converting when the currencies differ.
  const byAmount = inMonth.find((expense) => {
    const expenseCurrency = expense.currency.toUpperCase()
    const comparable =
      expenseCurrency === paymentCurrency
        ? expense.amount
        : convertCurrency(
            expense.amount,
            expenseCurrency,
            paymentCurrency,
            usdPenRate,
          )

    if (comparable === null) {
      return false
    }

    if (Math.round(comparable * 100) !== paymentCents) {
      return false
    }

    const day = Number(expense.spentAt.slice(8, 10))
    if (!Number.isFinite(day)) {
      return false
    }

    return Math.abs(day - dueDay) <= AMOUNT_MATCH_WINDOW_DAYS
  })

  return byAmount ? { expense: byAmount, reason: 'amount' } : null
}

/** Convenience map of recurring payment id to its detected match. */
export function detectRecurringMatches(
  payments: RecurringPayment[],
  expenses: Expense[],
  month: string,
  usdPenRate: number,
) {
  const matches = new Map<string, RecurringMatch>()

  for (const payment of payments) {
    if (payment.status !== 'active') {
      continue
    }

    const match = findRecurringMatch(payment, expenses, month, usdPenRate)
    if (match) {
      matches.set(payment.id, match)
    }
  }

  return matches
}
