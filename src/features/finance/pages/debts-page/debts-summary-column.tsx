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
  const debtScope = useMemo(
    () => debts.filter((debt) => debt.currency === defaultCurrency),
    [debts, defaultCurrency],
  )

  const recurringPaymentsInCurrency = useMemo(
    () =>
      recurringPayments.filter(
        (payment) =>
          payment.currency === defaultCurrency && payment.status === 'active',
      ),
    [recurringPayments, defaultCurrency],
  )

  const totalBalance = useMemo(
    () => debtScope.reduce((sum, debt) => sum + debt.balance, 0),
    [debtScope],
  )

  const totalRecurringMonthly = useMemo(
    () =>
      recurringPaymentsInCurrency.reduce(
        (sum, payment) => sum + payment.amount,
        0,
      ),
    [recurringPaymentsInCurrency],
  )

  const monthlyDebtPayment = useMemo(
    () => debtScope.reduce((sum, debt) => sum + getDebtPlannedPayment(debt), 0),
    [debtScope],
  )

  const projection = useMemo(() => getDebtProjection(debtScope), [debtScope])
  return (
    <div className="inline-block align-top w-[320px] rounded-[1.1rem] border border-[var(--border)] bg-[var(--panel)] p-3 sm:p-3.5">
      <div className="mb-3">
        <p className="eyebrow">Summary</p>
        <h2 className="mt-1 text-base font-semibold tracking-tight text-[var(--foreground)]">
          Complete overview
        </h2>
      </div>

      <DebtProjectionChart currency={defaultCurrency} points={projection} />

      <div className="mt-3 space-y-3">
        <div className="rounded-lg bg-[var(--surface-muted)] p-2.5">
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--foreground-faint)] mb-2">
            Monthly Payments
          </p>
          <div className="space-y-1.5 text-xs">
            {debtScope.length ? (
              debtScope.map((debt) => {
                const monthlyPayment = getDebtPlannedPayment(debt)
                return (
                  <div key={debt.id} className="flex justify-between">
                    <span className="text-[var(--foreground-soft)] truncate mr-2">
                      {debt.name}
                    </span>
                    <AnimatedCurrencyValue
                      className="font-mono whitespace-nowrap text-[var(--warning)]"
                      currency={debt.currency}
                      value={monthlyPayment}
                    />
                  </div>
                )
              })
            ) : (
              <div className="flex justify-between">
                <span className="text-[var(--foreground-soft)]">No debts</span>
                <span className="font-mono text-[var(--foreground)]">--</span>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg bg-[var(--surface-muted)] p-2.5">
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--foreground-faint)] mb-2">
            Recurring Payments Detail
          </p>
          <div className="space-y-1.5 text-xs">
            {recurringPaymentsInCurrency.length ? (
              recurringPaymentsInCurrency.map((payment) => (
                <div key={payment.id} className="flex justify-between">
                  <span className="text-[var(--foreground-soft)] truncate mr-2">
                    {payment.name}
                  </span>
                  <AnimatedCurrencyValue
                    className="font-mono whitespace-nowrap text-[var(--success)]"
                    currency={payment.currency}
                    value={payment.amount}
                  />
                </div>
              ))
            ) : (
              <div className="flex justify-between">
                <span className="text-[var(--foreground-soft)]">
                  No recurring payments
                </span>
                <span className="font-mono text-[var(--foreground)]">--</span>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg bg-[var(--surface-muted)] p-2.5">
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--foreground-faint)] mb-2">
            Combined Overview
          </p>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-[var(--foreground-soft)]">All debts</span>
              <AnimatedCurrencyValue
                className="font-mono text-[var(--foreground)]"
                currency={defaultCurrency}
                value={totalBalance}
              />
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--foreground-soft)]">
                All recurring
              </span>
              <AnimatedCurrencyValue
                className="font-mono text-[var(--foreground)]"
                currency={defaultCurrency}
                value={totalRecurringMonthly}
              />
            </div>
            <div className="flex justify-between border-t border-[var(--border)] pt-1.5 mt-1.5 font-semibold">
              <span className="text-[var(--foreground)]">Combined monthly</span>
              <AnimatedCurrencyValue
                className="font-mono text-[var(--warning)]"
                currency={defaultCurrency}
                value={monthlyDebtPayment + totalRecurringMonthly}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
