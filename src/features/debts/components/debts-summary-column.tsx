import { useMemo } from 'react'
import { AnimatedCurrencyValue } from '@/features/finance/shared'
import { getDebtPlannedPayment } from '@/lib/finance'
import type { Debt, Expense, RecurringPayment } from '@/lib/finance'
import { MonthlySpendChart } from './monthly-spend-chart'

interface DebtsSummaryColumnProps {
  debts: Debt[]
  expenses: Expense[]
  recurringPayments: RecurringPayment[]
}

export function DebtsSummaryColumn({
  debts,
  expenses,
  recurringPayments,
}: DebtsSummaryColumnProps) {
  const activeRecurringPayments = useMemo(
    () => recurringPayments.filter((payment) => payment.status === 'active'),
    [recurringPayments],
  )

  const overviewByCurrency = useMemo(() => {
    const totals = new Map<
      string,
      { debtBalance: number; recurringMonthly: number; debtMonthly: number }
    >()

    debts.forEach((debt) => {
      const currency = debt.currency.toUpperCase()
      const current = totals.get(currency) ?? {
        debtBalance: 0,
        recurringMonthly: 0,
        debtMonthly: 0,
      }
      totals.set(currency, {
        ...current,
        debtBalance: current.debtBalance + debt.balance,
        debtMonthly: current.debtMonthly + getDebtPlannedPayment(debt),
      })
    })

    activeRecurringPayments.forEach((payment) => {
      const currency = payment.currency.toUpperCase()
      const current = totals.get(currency) ?? {
        debtBalance: 0,
        recurringMonthly: 0,
        debtMonthly: 0,
      }
      totals.set(currency, {
        ...current,
        recurringMonthly: current.recurringMonthly + payment.amount,
      })
    })

    return Array.from(totals.entries()).sort(([left], [right]) =>
      left.localeCompare(right),
    )
  }, [activeRecurringPayments, debts])

  return (
    <div className="w-full rounded-[1.1rem] border border-border bg-card p-3 sm:p-3.5">
      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="min-w-0">
          <div className="mb-2">
            <p className="eyebrow">Overview</p>
            <h2 className="mt-1 text-base font-semibold tracking-tight text-foreground">
              Summary
            </h2>
          </div>

          <MonthlySpendChart
            debts={debts}
            expenses={expenses}
            recurringPayments={recurringPayments}
          />
        </div>

        {/* Stacked, not side by side: three narrow columns left the lists
            squeezed and the panels stretched with empty space below. */}
        <div className="flex min-w-0 flex-col gap-2">
          <SummaryPanel
            title="Monthly debt payments"
            empty={!debts.length ? 'No debts' : null}
          >
            {debts.map((debt) => (
              <SummaryRow
                key={debt.id}
                label={debt.name}
                currency={debt.currency}
                value={getDebtPlannedPayment(debt)}
                valueClassName="text-warning"
              />
            ))}
          </SummaryPanel>

          <SummaryPanel
            title="Recurring payments"
            empty={
              !activeRecurringPayments.length ? 'No recurring payments' : null
            }
          >
            {activeRecurringPayments.map((payment) => (
              <SummaryRow
                key={payment.id}
                label={payment.name}
                currency={payment.currency}
                value={payment.amount}
                valueClassName="text-success"
              />
            ))}
          </SummaryPanel>

          <SummaryPanel
            title="Combined monthly"
            empty={!overviewByCurrency.length ? 'No data' : null}
          >
            {overviewByCurrency.map(([currency, totals]) => (
              <div
                key={currency}
                className="rounded-md border border-border bg-card px-2.5 py-2"
              >
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-foreground-faint">
                  {currency}
                </p>
                <div className="space-y-1">
                  <SummaryRow
                    label="Debt"
                    currency={currency}
                    value={totals.debtMonthly}
                  />
                  <SummaryRow
                    label="Recurring"
                    currency={currency}
                    value={totals.recurringMonthly}
                  />
                  <div className="flex items-baseline justify-between border-t border-border pt-1 font-semibold">
                    <span className="text-foreground">Total</span>
                    <AnimatedCurrencyValue
                      className="font-mono whitespace-nowrap text-warning"
                      currency={currency}
                      value={totals.debtMonthly + totals.recurringMonthly}
                    />
                  </div>
                </div>
              </div>
            ))}
          </SummaryPanel>
        </div>
      </div>
    </div>
  )
}

function SummaryPanel({
  title,
  empty,
  children,
}: {
  title: string
  empty: string | null
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg bg-muted p-2.5">
      <p className="mb-2 text-[10px] uppercase tracking-[0.12em] text-foreground-faint">
        {title}
      </p>
      <div className="space-y-1.5 text-xs">
        {empty ? (
          <div className="flex justify-between">
            <span className="text-muted-foreground">{empty}</span>
            <span className="font-mono text-foreground">--</span>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}

function SummaryRow({
  label,
  currency,
  value,
  valueClassName = 'text-foreground',
}: {
  label: string
  currency: string
  value: number
  valueClassName?: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="min-w-0 truncate text-muted-foreground">{label}</span>
      <AnimatedCurrencyValue
        className={`font-mono whitespace-nowrap ${valueClassName}`}
        currency={currency}
        value={value}
      />
    </div>
  )
}
