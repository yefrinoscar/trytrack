import { Landmark, Target, WalletCards } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Field,
  FinancePageState,
  MetricCard,
  PageIntro,
  type FinanceActions,
} from '@/features/finance/shared'
import { formatCurrency, formatDate, getDashboardSummary } from '@/lib/finance'
import type { DashboardData } from '@/lib/finance'

export function SettingsPage() {
  return (
    <FinancePageState>
      {(data, actions) => <SettingsView actions={actions} data={data} />}
    </FinancePageState>
  )
}

function SettingsView({
  data,
  actions,
}: {
  data: DashboardData
  actions: FinanceActions
}) {
  const [selectedCurrency, setSelectedCurrency] = useState(
    data.settings.currency,
  )

  useEffect(() => {
    setSelectedCurrency(data.settings.currency)
  }, [data.settings.currency])

  const summary = getDashboardSummary(data)

  return (
    <main className="page-wrap px-4 pb-16 pt-10">
      <PageIntro
        eyebrow="Settings"
        title="Settings"
        description="Currency and data controls."
        meta={[
          { label: 'Storage', value: 'Browser only' },
          { label: 'Currency', value: data.settings.currency },
          { label: 'Updated', value: formatDate(data.settings.lastUpdated) },
        ]}
      />

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Currency</CardTitle>
            <CardDescription>
              Change how the desk displays money amounts. Existing values stay
              the same; only the formatting changes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <Field htmlFor="currency" label="Display currency">
                <Select
                  id="currency"
                  value={selectedCurrency}
                  onChange={(event) => setSelectedCurrency(event.target.value)}
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="MXN">MXN</option>
                  <option value="COP">COP</option>
                  <option value="PEN">PEN</option>
                </Select>
              </Field>
              <Button
                disabled={
                  actions.isWorking ||
                  selectedCurrency === data.settings.currency
                }
                onClick={() =>
                  void actions.updateSettings({ currency: selectedCurrency })
                }
              >
                Save currency
              </Button>
            </div>
            <Separator />
            <div className="grid gap-4 md:grid-cols-3">
              <MetricCard
                title="Net position"
                value={formatCurrency(summary.netPosition, selectedCurrency)}
                note="Same data, reformatted with the current display currency."
                icon={WalletCards}
              />
              <MetricCard
                title="Debt total"
                value={formatCurrency(summary.totalDebt, selectedCurrency)}
                note="Good for a quick check before changing the desk further."
                icon={Landmark}
              />
              <MetricCard
                title="Goal pool"
                value={formatCurrency(
                  summary.totalGoalCurrent,
                  selectedCurrency,
                )}
                note="How much already sits inside your active targets."
                icon={Target}
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Desk controls</CardTitle>
              <CardDescription>
                Reset back to the seeded example or clear everything and start
                from zero.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full"
                disabled={actions.isWorking}
                variant="secondary"
                onClick={() => void actions.resetDemoData()}
              >
                Reset demo data
              </Button>
              <Button
                className="w-full"
                disabled={actions.isWorking}
                variant="destructive"
                onClick={() => void actions.clearDashboard(selectedCurrency)}
              >
                Clear all data
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Current snapshot</CardTitle>
              <CardDescription>
                A quick count of what is living on the desk right now.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-base text-[var(--foreground-soft)] sm:grid-cols-2">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
                <p className="eyebrow text-[var(--foreground-faint)]">Debts</p>
                <p className="mt-2 text-base font-semibold text-[var(--foreground)]">
                  {data.debts.length}
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
                <p className="eyebrow text-[var(--foreground-faint)]">
                  Incomes
                </p>
                <p className="mt-2 text-base font-semibold text-[var(--foreground)]">
                  {data.incomes.length}
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
                <p className="eyebrow text-[var(--foreground-faint)]">
                  Investments
                </p>
                <p className="mt-2 text-base font-semibold text-[var(--foreground)]">
                  {data.investments.length}
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
                <p className="eyebrow text-[var(--foreground-faint)]">Goals</p>
                <p className="mt-2 text-base font-semibold text-[var(--foreground)]">
                  {data.goals.length}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  )
}
