import { useMemo } from 'react'
import {
  convertCurrency,
  formatCurrency,
  getDebtPlannedPayment,
} from '@/lib/finance'
import type { Debt, Expense, RecurringPayment } from '@/lib/finance'
import { MonthlySpendChart } from './monthly-spend-chart'

interface DebtsSummaryColumnProps {
  debts: Debt[]
  expenses: Expense[]
  recurringPayments: RecurringPayment[]
  /** PEN per USD, used to show the equivalent amount in the other currency. */
  usdPenRate: number
}

/**
 * Compact overview: the month's spending shape plus the committed monthly
 * totals. It deliberately shows sums rather than itemised lists, which belong
 * in the columns below.
 */
export function DebtsSummaryColumn({
  debts,
  expenses,
  recurringPayments,
  usdPenRate,
}: DebtsSummaryColumnProps) {
  const totals = useMemo(() => {
    const debtMonthly = new Map<string, number>()
    const recurringMonthly = new Map<string, number>()

    for (const debt of debts) {
      if (debt.status === 'closed' || debt.balance <= 0) {
        continue
      }
      const currency = debt.currency.toUpperCase()
      debtMonthly.set(
        currency,
        (debtMonthly.get(currency) ?? 0) + getDebtPlannedPayment(debt),
      )
    }

    for (const payment of recurringPayments) {
      if (payment.status !== 'active') {
        continue
      }
      const currency = payment.currency.toUpperCase()
      recurringMonthly.set(
        currency,
        (recurringMonthly.get(currency) ?? 0) + payment.amount,
      )
    }

    const sort = (map: Map<string, number>) =>
      Array.from(map.entries()).sort(([left], [right]) =>
        left.localeCompare(right),
      )

    return {
      debt: sort(debtMonthly),
      recurring: sort(recurringMonthly),
    }
  }, [debts, recurringPayments])

  return (
    <div className="w-full rounded-[1.1rem] border border-border bg-card p-3">
      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr] lg:items-center">
        <div className="min-w-0">
          <p className="eyebrow">Overview · Summary</p>
          <MonthlySpendChart
            debts={debts}
            expenses={expenses}
            recurringPayments={recurringPayments}
          />
        </div>

        <dl className="grid gap-2 lg:border-l lg:border-border lg:pl-4">
          <SummaryStat
            label="Debt per month"
            usdPenRate={usdPenRate}
            values={totals.debt}
            valueClassName="text-warning"
          />
          <SummaryStat
            label="Recurring per month"
            usdPenRate={usdPenRate}
            values={totals.recurring}
            valueClassName="text-success"
          />
        </dl>
      </div>
    </div>
  )
}

function SummaryStat({
  label,
  usdPenRate,
  values,
  valueClassName,
}: {
  label: string
  usdPenRate: number
  values: Array<[string, number]>
  valueClassName: string
}) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.12em] text-foreground-faint">
        {label}
      </dt>
      <dd className="mt-0.5 flex flex-wrap items-baseline gap-x-3 font-mono text-sm">
        {values.length ? (
          values.map(([currency, total]) => {
            // Show the equivalent in the other supported currency right next
            // to the real amount, so the number is never mistaken for a total.
            const target =
              currency === 'USD' ? 'PEN' : currency === 'PEN' ? 'USD' : null
            const converted = target
              ? convertCurrency(total, currency, target, usdPenRate)
              : null

            return (
              <span key={currency}>
                <span className={valueClassName}>
                  {formatCurrency(total, currency)}
                </span>
                {converted !== null && target ? (
                  <span className="text-muted-foreground">
                    {' · '}
                    {formatCurrency(converted, target)}
                  </span>
                ) : null}
              </span>
            )
          })
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </dd>
    </div>
  )
}
