/**
 * Daily outflow for the current month: everything that leaves the account on a
 * given day, not just manually recorded expenses.
 *
 * Feeding it expenses, recurring charges and debt installments means the chart
 * answers "how much came out today / which day cost the most" in one line.
 *
 * Amounts are never added across currencies. The series shown is the one with
 * the highest total, which is where the real activity is.
 */
export type OutflowEntry = {
  currency: string
  /** YYYY-MM-DD. */
  date: string
  amount: number
}

export type DailyOutflow = {
  currency: string | null
  /** Day of the month (1-31) mapped to the total that day. */
  byDay: Map<number, number>
  total: number
  peak: { day: number; amount: number }
  /** Days elapsed in the month, 1..today. */
  daysElapsed: number
  monthLabel: string
  /** Month totals for every other currency, so nothing is hidden silently. */
  otherCurrencies: Array<{ currency: string; total: number }>
}

export function aggregateMonthlyOutflow(
  entries: OutflowEntry[],
  reference: Date = new Date(),
): DailyOutflow {
  const year = reference.getFullYear()
  const month = reference.getMonth()
  const daysElapsed = reference.getDate()
  const byCurrency = new Map<string, Map<number, number>>()

  for (const entry of entries) {
    const [entryYear, entryMonth, entryDay] = entry.date.split('-').map(Number)

    if (entryYear !== year || entryMonth !== month + 1) {
      continue
    }

    if (!Number.isFinite(entryDay) || entryDay < 1 || entryDay > 31) {
      continue
    }

    if (!Number.isFinite(entry.amount) || entry.amount === 0) {
      continue
    }

    const currency = entry.currency.toUpperCase()
    const days = byCurrency.get(currency) ?? new Map<number, number>()
    days.set(entryDay, (days.get(entryDay) ?? 0) + entry.amount)
    byCurrency.set(currency, days)
  }

  const totals = Array.from(byCurrency.entries())
    .map(([currency, days]) => ({
      currency,
      days,
      total: Array.from(days.values()).reduce((sum, value) => sum + value, 0),
    }))
    .sort((left, right) => right.total - left.total)

  const primary = totals[0]
  let peakDay = 0
  let peakAmount = 0

  if (primary) {
    for (const [day, amount] of primary.days) {
      if (amount > peakAmount) {
        peakAmount = amount
        peakDay = day
      }
    }
  }

  return {
    currency: primary?.currency ?? null,
    byDay: primary?.days ?? new Map(),
    total: primary?.total ?? 0,
    peak: { day: peakDay, amount: peakAmount },
    daysElapsed,
    monthLabel: reference.toLocaleDateString('en-US', { month: 'long' }),
    otherCurrencies: totals.slice(1).map(({ currency, total }) => ({
      currency,
      total,
    })),
  }
}
