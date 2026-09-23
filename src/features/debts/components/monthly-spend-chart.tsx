import { useMemo } from 'react'
import { formatCurrency } from '@/lib/finance'
import { aggregateMonthlySpend } from '@/lib/monthly-spend'
import type { Expense } from '@/lib/finance'

/**
 * Spending for each day of the current month, up to today.
 *
 * Answers "which day did I spend the most?": the highest day is drawn in the
 * accent colour and called out underneath, and the axis only covers days that
 * have already happened.
 */
export function MonthlySpendChart({
  expenses,
  currency,
}: {
  expenses: Expense[]
  currency: string
}) {
  const { byDay, total, peak, daysElapsed, monthLabel } = useMemo(
    () => aggregateMonthlySpend(expenses, currency),
    [currency, expenses],
  )

  const days = Array.from({ length: daysElapsed }, (_, index) => index + 1)
  const maxAmount = Math.max(peak.amount, 1)

  return (
    <div>
      <div className="mb-2">
        <p className="text-xs uppercase tracking-[0.12em] text-foreground-faint">
          Spent in {monthLabel}
        </p>
        <p className="mt-1 font-mono text-lg text-foreground">
          {formatCurrency(total, currency)}
        </p>
      </div>

      <div className="flex h-[132px] items-end gap-[3px]">
        {days.map((day) => {
          const amount = byDay.get(day) ?? 0
          const ratio = amount / maxAmount
          const isPeak = amount > 0 && day === peak.day

          return (
            <div
              key={day}
              className="flex h-full flex-1 flex-col justify-end"
              title={`${monthLabel} ${day}: ${formatCurrency(amount, currency)}`}
            >
              <div
                className={`w-full rounded-sm ${
                  isPeak
                    ? 'bg-violet-400'
                    : amount > 0
                      ? 'bg-violet-400/45'
                      : 'bg-border/60'
                }`}
                style={{
                  height: amount > 0 ? `${Math.max(ratio * 100, 4)}%` : '2px',
                }}
              />
            </div>
          )
        })}
      </div>

      <div className="mt-1.5 flex items-center justify-between text-[10px] uppercase tracking-[0.1em] text-foreground-faint">
        <span>1</span>
        <span>{daysElapsed}</span>
      </div>

      <p className="mt-2 text-xs text-foreground-faint">
        {peak.day > 0 ? (
          <>
            Most spent on{' '}
            <span className="font-medium text-foreground">
              {monthLabel} {peak.day}
            </span>
            {' · '}
            <span className="font-mono text-foreground">
              {formatCurrency(peak.amount, currency)}
            </span>
          </>
        ) : (
          <>No expenses recorded this month yet.</>
        )}
      </p>
    </div>
  )
}
