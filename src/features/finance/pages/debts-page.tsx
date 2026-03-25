import { FinancePageState } from '@/features/finance/shared'
import type { FinanceActions } from '@/features/finance/shared'
import type { DashboardData } from '@/lib/finance'
import { DebtsListColumn } from './debts-page/debts-list-column'
import { RecurringPaymentsColumn } from './debts-page/recurring-payments-column'
import { DebtsSummaryColumn } from './debts-page/debts-summary-column'

export function DebtsPage() {
  return (
    <FinancePageState loading={<DebtsLoadingState />}>
      {(data, actions) => <DebtsView actions={actions} data={data} />}
    </FinancePageState>
  )
}

function DebtsView({
  data,
  actions,
}: {
  data: DashboardData
  actions: FinanceActions
}) {
  const defaultCurrency = data.settings.currency

  return (
    <main className="page-wrap flex flex-1 flex-col pb-4 px-4">
      <section className="space-x-3">
        <DebtsListColumn
          debts={data.debts}
          defaultCurrency={defaultCurrency}
          actions={actions}
        />

        <RecurringPaymentsColumn
          recurringPayments={data.recurringPayments}
          defaultCurrency={defaultCurrency}
          actions={actions}
        />

        <DebtsSummaryColumn
          debts={data.debts}
          recurringPayments={data.recurringPayments}
          defaultCurrency={defaultCurrency}
        />
      </section>
    </main>
  )
}

function DebtsLoadingState() {
  return (
    <main className="page-wrap flex flex-1 flex-col px-4 pb-4">
      <section className="space-x-3">
        <DebtColumnSkeleton />
        <RecurringColumnSkeleton />
        <SummaryColumnSkeleton />
      </section>
    </main>
  )
}

function DebtColumnSkeleton() {
  return (
    <div className="inline-block w-[320px] animate-pulse rounded-[1.1rem] border border-[var(--border)] bg-[var(--panel)] p-3 align-top sm:p-3.5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="space-y-2">
          <div className="h-3 w-14 rounded-full bg-[var(--surface-muted)]" />
          <div className="h-5 w-28 rounded-full bg-[var(--surface-muted)]" />
        </div>
        <div className="h-8 w-14 rounded-full bg-[var(--surface-muted)]" />
      </div>

      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_debtSlot, index) => (
          <div
            key={index}
            className="rounded-lg bg-[var(--surface-muted)] p-2.5"
          >
            <div className="mb-2 flex items-start gap-3">
              <div className="h-11 w-11 rounded-lg border border-[var(--border)] bg-[var(--panel)]" />
              <div className="min-w-0 flex-1 space-y-2 pt-0.5">
                <div className="h-4 w-28 rounded-full bg-[var(--panel)]" />
                <div className="h-3 w-24 rounded-full bg-[var(--panel)]" />
              </div>
              <div className="h-6 w-6 rounded-full bg-[var(--panel)]" />
            </div>

            <div className="mb-2 ml-[56px] space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="h-3 w-12 rounded-full bg-[var(--panel)]" />
                <div className="h-4 w-20 rounded-full bg-[var(--panel)]" />
              </div>
            </div>

            <div className="ml-[56px] border-t border-[var(--border)] pt-2">
              <div className="mb-2 h-3 w-32 rounded-full bg-[var(--panel)]" />
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: 3 }).map(
                  (_installmentSlot, chipIndex) => (
                    <div
                      key={chipIndex}
                      className="h-6 w-[4.5rem] rounded-md bg-[var(--panel)]"
                    />
                  ),
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function RecurringColumnSkeleton() {
  return (
    <div className="inline-block w-[320px] animate-pulse rounded-[1.1rem] border border-[var(--border)] bg-[var(--panel)] p-3 align-top sm:p-3.5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="space-y-2">
          <div className="h-3 w-24 rounded-full bg-[var(--surface-muted)]" />
          <div className="h-5 w-36 rounded-full bg-[var(--surface-muted)]" />
        </div>
        <div className="h-8 w-14 rounded-full bg-[var(--surface-muted)]" />
      </div>

      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_groupSlot, sectionIndex) => (
          <section key={sectionIndex} className="space-y-2.5">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-4 w-16 rounded-full bg-[var(--surface-muted)]" />
                <div className="h-4 w-6 rounded-full bg-[var(--surface-muted)]" />
              </div>
              <div className="h-3 w-32 rounded-full bg-[var(--surface-muted)]" />
            </div>

            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_paymentSlot, itemIndex) => (
                <div
                  key={itemIndex}
                  className="rounded-lg bg-[var(--surface-muted)] p-2.5"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-lg bg-[var(--panel)]" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-4 w-24 rounded-full bg-[var(--panel)]" />
                      <div className="h-3 w-20 rounded-full bg-[var(--panel)]" />
                    </div>
                    <div className="h-4 w-16 rounded-full bg-[var(--panel)]" />
                    <div className="h-6 w-6 rounded-full bg-[var(--panel)]" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

function SummaryColumnSkeleton() {
  return (
    <div className="inline-block w-[320px] animate-pulse rounded-[1.1rem] border border-[var(--border)] bg-[var(--panel)] p-3 align-top sm:p-3.5">
      <div className="mb-3 space-y-2">
        <div className="h-3 w-14 rounded-full bg-[var(--surface-muted)]" />
        <div className="h-5 w-32 rounded-full bg-[var(--surface-muted)]" />
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-3">
        <div className="mb-3 space-y-2">
          <div className="h-3 w-12 rounded-full bg-[var(--panel)]" />
          <div className="h-6 w-28 rounded-full bg-[var(--panel)]" />
        </div>
        <div className="mb-3 flex items-center justify-between gap-4">
          <div className="h-3 w-[4.5rem] rounded-full bg-[var(--panel)]" />
          <div className="h-3 w-[4.5rem] rounded-full bg-[var(--panel)]" />
        </div>
        <div className="h-20 rounded-xl bg-[linear-gradient(180deg,var(--panel)_0%,transparent_100%)]" />
        <div className="mt-3 flex items-center justify-between gap-4">
          <div className="h-3 w-10 rounded-full bg-[var(--panel)]" />
          <div className="h-3 w-10 rounded-full bg-[var(--panel)]" />
          <div className="h-3 w-10 rounded-full bg-[var(--panel)]" />
        </div>
      </div>

      <div className="mt-3 space-y-3">
        {Array.from({ length: 3 }).map((_summaryBlock, index) => (
          <div
            key={index}
            className="rounded-lg bg-[var(--surface-muted)] p-2.5"
          >
            <div className="mb-2 h-3 w-28 rounded-full bg-[var(--panel)]" />
            <div className="space-y-1.5">
              {Array.from({ length: index === 2 ? 3 : 2 }).map(
                (_summaryRow, rowIndex) => (
                  <div
                    key={rowIndex}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="h-3 w-20 rounded-full bg-[var(--panel)]" />
                    <div className="h-3 w-16 rounded-full bg-[var(--panel)]" />
                  </div>
                ),
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
