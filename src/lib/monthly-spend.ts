/**
 * Aggregates expenses into the current month, bucketed by day and split per
 * currency.
 *
 * One series per currency so amounts are never added across S/ and $, which
 * would produce a meaningless total.
 */
export type MonthlySpendSeries = {
  currency: string
  /** Day of the month (1-31) mapped to the total spent that day. */
  byDay: Map<number, number>
  total: number
  peak: { day: number; amount: number }
}

export type MonthlySpend = {
  series: MonthlySpendSeries[]
  /** Days elapsed in the month, 1..today. */
  daysElapsed: number
  monthLabel: string
}

export function aggregateMonthlySpend(
  expenses: Array<{ amount: number; currency: string; spentAt: string }>,
  reference: Date = new Date(),
): MonthlySpend {
  const year = reference.getFullYear()
  const month = reference.getMonth()
  const daysElapsed = reference.getDate()
  const buckets = new Map<string, Map<number, number>>()

  for (const expense of expenses) {
    const [expenseYear, expenseMonth, expenseDay] = expense.spentAt
      .split('-')
      .map(Number)

    if (expenseYear !== year || expenseMonth !== month + 1) {
      continue
    }

    if (!Number.isFinite(expenseDay) || expenseDay < 1) {
      continue
    }

    const currency = expense.currency.toUpperCase()
    const days = buckets.get(currency) ?? new Map<number, number>()
    days.set(expenseDay, (days.get(expenseDay) ?? 0) + expense.amount)
    buckets.set(currency, days)
  }

  const series = Array.from(buckets.entries())
    .map(([currency, byDay]) => {
      let total = 0
      let peakDay = 0
      let peakAmount = 0

      for (const [day, amount] of byDay) {
        total += amount
        if (amount > peakAmount) {
          peakAmount = amount
          peakDay = day
        }
      }

      return {
        currency,
        byDay,
        total,
        peak: { day: peakDay, amount: peakAmount },
      }
    })
    .sort((left, right) => right.total - left.total)

  return {
    series,
    daysElapsed,
    monthLabel: reference.toLocaleDateString('en-US', { month: 'long' }),
  }
}
