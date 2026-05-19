import { useMemo } from 'react'
import {
  AnimatedCurrencyValue,
  DebtProjectionChart,
} from '@/features/finance/shared'
import { getDebtPlannedPayment, getDebtProjection } from '@/lib/finance'
import type { Debt, RecurringPayment } from '@/lib/finance'

interface DebtsSummaryColumnProps {
  debts: Debt[]
  recurringPayments: RecurringPayment[]
  defaultCurrency: string
}

export function DebtsSummaryColumn({
  debts,
  recurringPayments,
  defaultCurrency,
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

  const projection = useMemo(() => getDebtProjection(debts), [debts])
  const projectionSeries = useMemo(() => {
    const groups = new Map<string, Debt[]>()
    debts.forEach((debt) => {
      const currency = debt.currency.toUpperCase()
      const current = groups.get(currency) ?? []
      current.push(debt)
      groups.set(currency, current)
    })

    return Array.from(groups.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([currency, currencyDebts]) => ({
        currency,
        points: getDebtProjection(currencyDebts),
      }))
      .filter((series) => series.points.length > 0)
  }, [debts])
  return (
    <div className="w-full rounded-[1.1rem] border border-border bg-card p-3 sm:p-3.5">
      <div className="grid gap-3 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="min-w-0">
          <div className="mb-2">
            <p className="eyebrow">Overview</p>
            <h2 className="mt-1 text-base font-semibold tracking-tight text-foreground">
              Summary
            </h2>
          </div>

          <DebtProjectionChart
            currency={defaultCurrency}
            points={projection}
            series={projectionSeries}
            compact
          />
        </div>

        <div className="grid min-w-0 gap-2 lg:grid-cols-3">
          <div className="rounded-lg bg-muted p-2.5">
            <p className="text-[10px] uppercase tracking-[0.12em] text-foreground-faint mb-2">
              Monthly Payments
            </p>
            <div className="max-h-32 space-y-1.5 overflow-y-auto pr-1 text-xs">
              {debts.length ? (
                debts.map((debt) => {
                  const monthlyPayment = getDebtPlannedPayment(debt)
                  return (
                    <div key={debt.id} className="flex justify-between">
                      <span className="text-muted-foreground truncate mr-2">
                        {debt.name}
                      </span>
                      <AnimatedCurrencyValue
                        className="font-mono whitespace-nowrap text-warning"
                        currency={debt.currency}
                        value={monthlyPayment}
                      />
                    </div>
                  )
                })
              ) : (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">No debts</span>
                  <span className="font-mono text-foreground">--</span>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg bg-muted p-2.5">
            <p className="text-[10px] uppercase tracking-[0.12em] text-foreground-faint mb-2">
              Recurring Payments Detail
            </p>
            <div className="max-h-32 space-y-1.5 overflow-y-auto pr-1 text-xs">
              {activeRecurringPayments.length ? (
                activeRecurringPayments.map((payment) => (
                  <div key={payment.id} className="flex justify-between">
                    <span className="text-muted-foreground truncate mr-2">
                      {payment.name}
                    </span>
                    <AnimatedCurrencyValue
                      className="font-mono whitespace-nowrap text-success"
                      currency={payment.currency}
                      value={payment.amount}
                    />
                  </div>
                ))
              ) : (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    No recurring payments
                  </span>
                  <span className="font-mono text-foreground">--</span>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg bg-muted p-2.5">
            <p className="text-[10px] uppercase tracking-[0.12em] text-foreground-faint mb-2">
              Combined Overview
            </p>
            <div className="max-h-32 space-y-2 overflow-y-auto pr-1 text-xs">
              {overviewByCurrency.length ? (
                overviewByCurrency.map(([currency, totals]) => (
                  <div
                    key={currency}
                    className="rounded-md border border-border bg-card px-2.5 py-2"
                  >
                    <div className="mb-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-foreground-faint">
                        {currency === 'PEN' ? 'Soles (PEN)' : currency}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Debt</span>
                        <AnimatedCurrencyValue
                          className="font-mono text-foreground"
                          currency={currency}
                          value={totals.debtMonthly}
                        />
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Recurring</span>
                        <AnimatedCurrencyValue
                          className="font-mono text-foreground"
                          currency={currency}
                          value={totals.recurringMonthly}
                        />
                      </div>
                      <div className="flex justify-between border-t border-border pt-1.5 font-semibold">
                        <span className="text-foreground">Total</span>
                        <AnimatedCurrencyValue
                          className="font-mono text-warning"
                          currency={currency}
                          value={totals.debtMonthly + totals.recurringMonthly}
                        />
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">No data</span>
                  <span className="font-mono text-foreground">--</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
