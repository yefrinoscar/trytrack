import { useMemo } from 'react'
import { formatCurrency, getDebtPlannedPayment } from '@/lib/finance'
import { aggregateMonthlyOutflow } from '@/lib/monthly-spend'
import type { OutflowEntry } from '@/lib/monthly-spend'
import type { Debt, Expense, RecurringPayment } from '@/lib/finance'

/**
 * Everything that leaves the account this month, day by day: recorded expenses,
 * recurring charges on their due day and debt installments on their due date.
 *
 * One line, one currency (the busiest one), so it answers "which day cost the
 * most" without comparing S/ against $.
 */
const WIDTH = 700
const HEIGHT = 88
const PAD_X = 8
const PAD_TOP = 8
const PAD_BOTTOM = 14

function buildPath(points: Array<{ x: number; y: number }>) {
  if (!points.length) {
    return ''
  }

  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')
}

function buildArea(points: Array<{ x: number; y: number }>, baseline: number) {
  if (!points.length) {
    return ''
  }

  const first = points[0]!
  const last = points[points.length - 1]!
  return `${buildPath(points)} L ${last.x} ${baseline} L ${first.x} ${baseline} Z`
}

export function MonthlySpendChart({
  debts,
  expenses,
  recurringPayments,
}: {
  debts: Debt[]
  expenses: Expense[]
  recurringPayments: RecurringPayment[]
}) {
  const outflow = useMemo(() => {
    const now = new Date()
    const monthKey = String(now.getMonth() + 1).padStart(2, '0')
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const entries: OutflowEntry[] = []

    for (const expense of expenses) {
      entries.push({
        currency: expense.currency,
        date: expense.spentAt,
        amount: expense.amount,
      })
    }

    for (const payment of recurringPayments) {
      if (payment.status !== 'active') {
        continue
      }

      const day = Math.min(Math.max(Math.round(payment.dueDay), 1), lastDay)
      const date = `${now.getFullYear()}-${monthKey}-${String(day).padStart(2, '0')}`

      if (date < payment.startDate) {
        continue
      }
      if (payment.endDate && date > payment.endDate) {
        continue
      }

      entries.push({
        currency: payment.currency,
        date,
        amount: payment.amount,
      })
    }

    for (const debt of debts) {
      if (debt.status === 'closed' || debt.balance <= 0) {
        continue
      }

      entries.push({
        currency: debt.currency,
        date: debt.dueDate,
        amount: getDebtPlannedPayment(debt),
      })
    }

    return aggregateMonthlyOutflow(entries)
  }, [debts, expenses, recurringPayments])

  const { byDay, total, peak, daysElapsed, monthLabel, currency } = outflow
  const days = Array.from({ length: daysElapsed }, (_, index) => index + 1)
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM
  const plotWidth = WIDTH - PAD_X * 2
  const baseline = PAD_TOP + plotHeight
  const maxAmount = Math.max(...Array.from(byDay.values()), 1)
  const stepX = daysElapsed > 1 ? plotWidth / (daysElapsed - 1) : 0

  const points = days.map((day) => ({
    x: PAD_X + (day - 1) * stepX,
    y: PAD_TOP + (1 - (byDay.get(day) ?? 0) / maxAmount) * plotHeight,
  }))

  return (
    <div>
      <div className="mb-0.5">
        <p className="text-xs uppercase tracking-[0.12em] text-foreground-faint">
          Daily spending · {monthLabel}
        </p>
        <p className="mt-0.5 font-mono text-base text-foreground">
          {currency ? formatCurrency(total, currency) : '—'}
        </p>
        {outflow.otherCurrencies.length ? (
          <p className="text-[10px] text-foreground-faint">
            plus{' '}
            {outflow.otherCurrencies
              .map((item) => formatCurrency(item.total, item.currency))
              .join(', ')}{' '}
            in another currency
          </p>
        ) : null}
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="h-[88px] w-full"
        role="img"
        aria-label={`Daily spending for ${monthLabel}`}
      >
        {[0.25, 0.5, 0.75].map((ratio) => (
          <path
            key={ratio}
            d={`M ${PAD_X} ${PAD_TOP + ratio * plotHeight} H ${WIDTH - PAD_X}`}
            className="stroke-border"
            strokeDasharray="2 6"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <path
          d={`M ${PAD_X} ${baseline} H ${WIDTH - PAD_X}`}
          className="stroke-border"
          vectorEffect="non-scaling-stroke"
        />
        {points.length ? (
          <path
            d={buildArea(points, baseline)}
            className="fill-violet-500"
            fillOpacity="0.12"
          />
        ) : null}
        {points.length ? (
          <path
            d={buildPath(points)}
            fill="none"
            className="stroke-violet-500"
            strokeWidth="2"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>

      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.1em] text-foreground-faint">
        <span>1</span>
        {daysElapsed > 2 ? <span>{Math.round(daysElapsed / 2)}</span> : null}
        <span>{daysElapsed}</span>
      </div>

      <p className="mt-1 text-[11px] text-foreground-faint">
        {currency && peak.day > 0 ? (
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
          <>No movement recorded this month yet.</>
        )}
      </p>
    </div>
  )
}
