import { FinancePageState } from '@/features/finance/shared'
import type { FinanceActions } from '@/features/finance/shared'
import type { DashboardData } from '@/lib/finance'
import { DebtsListColumn } from './components/debts-list-column'
import { DailyExpensesColumn } from './components/daily-expenses-column'
import { RecurringPaymentsColumn } from './components/recurring-payments-column'
import { DebtsSummaryColumn } from './components/debts-summary-column'

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
  const enabledCurrencies = data.settings.enabledCurrencies

  return (
    <main className="page-wrap debts-page-wrap flex flex-1 flex-col gap-3 px-3 pb-4">
      <DebtsSummaryColumn
        debts={data.debts}
        recurringPayments={data.recurringPayments}
        defaultCurrency={defaultCurrency}
      />

      <section className="grid gap-3 lg:grid-cols-3">
        <DebtsListColumn
          debts={data.debts}
          defaultCurrency={defaultCurrency}
          enabledCurrencies={enabledCurrencies}
          actions={actions}
        />

        <DailyExpensesColumn
          expenses={data.expenses}
          defaultCurrency={defaultCurrency}
          actions={actions}
        />

        <RecurringPaymentsColumn
          recurringPayments={data.recurringPayments}
          defaultCurrency={defaultCurrency}
          enabledCurrencies={enabledCurrencies}
          actions={actions}
        />
      </section>
    </main>
  )
}

function DebtsLoadingState() {
  return (
    <main className="page-wrap debts-page-wrap flex flex-1 flex-col gap-3 px-3 pb-4">
      <SummaryColumnSkeleton />
      <section className="grid gap-3 lg:grid-cols-3">
        <DebtColumnSkeleton />
        <DailyExpensesColumnSkeleton />
        <RecurringColumnSkeleton />
      </section>
    </main>
  )
}

function DebtColumnSkeleton() {
  return (
    <div className="w-full animate-pulse rounded-[1.1rem] border border-border bg-card p-3 sm:p-3.5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="space-y-2">
          <div className="h-3 w-14 rounded-full bg-muted" />
          <div className="h-5 w-28 rounded-full bg-muted" />
        </div>
        <div className="h-8 w-14 rounded-full bg-muted" />
      </div>

      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_debtSlot, index) => (
          <div key={index} className="rounded-lg bg-muted p-2.5">
            <div className="mb-2 flex items-start gap-3">
              <div className="h-11 w-11 rounded-lg border border-border bg-card" />
              <div className="min-w-0 flex-1 space-y-2 pt-0.5">
                <div className="h-4 w-28 rounded-full bg-card" />
                <div className="h-3 w-24 rounded-full bg-card" />
              </div>
              <div className="h-6 w-6 rounded-full bg-card" />
            </div>

            <div className="mb-2 ml-[56px] space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="h-3 w-12 rounded-full bg-card" />
                <div className="h-4 w-20 rounded-full bg-card" />
              </div>
            </div>

            <div className="ml-[56px] border-t border-border pt-2">
              <div className="mb-2 h-3 w-32 rounded-full bg-card" />
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: 3 }).map(
                  (_installmentSlot, chipIndex) => (
                    <div
                      key={chipIndex}
                      className="h-6 w-[4.5rem] rounded-md bg-card"
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

function DailyExpensesColumnSkeleton() {
  return (
    <div className="w-full animate-pulse rounded-[1.1rem] border border-border bg-card p-3 sm:p-3.5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="space-y-2">
          <div className="h-3 w-12 rounded-full bg-muted" />
          <div className="h-5 w-32 rounded-full bg-muted" />
        </div>
        <div className="h-5 w-20 rounded-full bg-muted" />
      </div>
      <div className="h-12 rounded-lg bg-muted" />
      <div className="mt-3 space-y-2">
        {Array.from({ length: 3 }).map((_expenseSlot, index) => (
          <div key={index} className="rounded-lg bg-muted p-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-2">
                <div className="h-4 w-24 rounded-full bg-card" />
                <div className="h-3 w-14 rounded-full bg-card" />
              </div>
              <div className="h-4 w-16 rounded-full bg-card" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function RecurringColumnSkeleton() {
  return (
    <div className="w-full animate-pulse rounded-[1.1rem] border border-border bg-card p-3 sm:p-3.5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="space-y-2">
          <div className="h-3 w-24 rounded-full bg-muted" />
          <div className="h-5 w-36 rounded-full bg-muted" />
        </div>
        <div className="h-8 w-14 rounded-full bg-muted" />
      </div>

      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_groupSlot, sectionIndex) => (
          <section key={sectionIndex} className="space-y-2.5">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-4 w-16 rounded-full bg-muted" />
                <div className="h-4 w-6 rounded-full bg-muted" />
              </div>
              <div className="h-3 w-32 rounded-full bg-muted" />
            </div>

            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_paymentSlot, itemIndex) => (
                <div key={itemIndex} className="rounded-lg bg-muted p-2.5">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-lg bg-card" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-4 w-24 rounded-full bg-card" />
                      <div className="h-3 w-20 rounded-full bg-card" />
                    </div>
                    <div className="h-4 w-16 rounded-full bg-card" />
                    <div className="h-6 w-6 rounded-full bg-card" />
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
    <div className="w-full animate-pulse rounded-[1.1rem] border border-border bg-card p-3 sm:p-3.5">
      <div className="grid gap-3 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="h-3 w-14 rounded-full bg-muted" />
            <div className="h-5 w-32 rounded-full bg-muted" />
          </div>
          <div className="h-20 rounded-xl bg-muted" />
        </div>
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_summaryBlock, index) => (
            <div key={index} className="rounded-lg bg-muted p-2.5">
              <div className="mb-2 h-3 w-24 rounded-full bg-card" />
              <div className="space-y-1.5">
                <div className="h-3 w-full rounded-full bg-card" />
                <div className="h-3 w-4/5 rounded-full bg-card" />
                <div className="h-3 w-3/5 rounded-full bg-card" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
