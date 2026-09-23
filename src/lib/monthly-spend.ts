/**
 * Aggregates expenses into the current month, bucketed by day.
 *
 * Powers the Summary chart: the day with the highest spend is what the user
 * wants to spot, so it is computed here rather than in the component.
 */
export type MonthlySpend = {
  /** Day of the month (1-31) mapped to the total spent that day. */
  byDay: Map<number, number>
  total: number
  peak: { day: number; amount: number }
  /** Days elapsed in the month, 1..today. */
  daysElapsed: number
  monthLabel: string
}

export function aggregateMonthlySpend(
  expenses: Array<{ amount: number; currency: string; spentAt: string }>,
  currency: string,
  reference: Date = new Date(),
): MonthlySpend {
  const year = reference.getFullYear()
  const month = reference.getMonth()
  const daysElapsed = reference.getDate()
  const target = currency.toUpperCase()
  const byDay = new Map<number, number>()

  for (const expense of expenses) {
    if (expense.currency.toUpperCase() !== target) {
      continue
    }

    const [expenseYear, expenseMonth, expenseDay] = expense.spentAt
      .split('-')
      .map(Number)

    if (expenseYear !== year || expenseMonth !== month + 1) {
      continue
    }

    if (!Number.isFinite(expenseDay) || expenseDay < 1) {
      continue
    }

    byDay.set(expenseDay, (byDay.get(expenseDay) ?? 0) + expense.amount)
  }

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
    byDay,
    total,
    peak: { day: peakDay, amount: peakAmount },
    daysElapsed,
    monthLabel: reference.toLocaleDateString('en-US', { month: 'long' }),
  }
}
