import { ArrowDownToLine, Landmark, Target, WalletCards } from 'lucide-react'
import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  EmptyRow,
  FinancePageState,
  MetricCard,
  PageIntro,
  QuickLinkCard,
  SectionTitle,
  currencyVariant,
  sortByDateAscending,
} from '@/features/finance/shared'
import {
  formatCompactCurrency,
  formatCurrency,
  formatDate,
  formatPercent,
  getAverageInvestmentChange,
  getDashboardSummary,
  getDebtMonthlyTotalsByCurrency,
  getRecentEntries,
  isSeedDataActive,
} from '@/lib/finance'
import type { DashboardData } from '@/lib/finance'

export function OverviewPage() {
  return (
    <FinancePageState>
      {(data) => <OverviewView data={data} />}
    </FinancePageState>
  )
}

function OverviewView({ data }: { data: DashboardData }) {
  const summary = useMemo(() => getDashboardSummary(data), [data])
  const recent = useMemo(() => getRecentEntries(data), [data])
  const hasDemoData = isSeedDataActive(data)
  const debtMonthlyTotals = useMemo(
    () => getDebtMonthlyTotalsByCurrency(data.debts),
    [data.debts],
  )
  const sortedDebts = useMemo(
    () => sortByDateAscending(data.debts, (item) => item.dueDate),
    [data.debts],
  )
  const sortedIncomes = useMemo(
    () => sortByDateAscending(data.incomes, (item) => item.nextDate),
    [data.incomes],
  )
  const sortedGoals = useMemo(
    () => sortByDateAscending(data.goals, (item) => item.deadline),
    [data.goals],
  )
  const currency = data.settings.currency
  const totalOpenLanes =
    data.debts.length +
    data.incomes.length +
    data.investments.length +
    data.goals.length

  const nextDebt = sortedDebts.at(0)
  const nextIncome = sortedIncomes.at(0)
  const nextGoal = sortedGoals.at(0)

  return (
    <main className="page-wrap px-4 pb-16 pt-10">
      <PageIntro
        eyebrow="Overview"
        title="Overview"
        description={
          hasDemoData
            ? 'Demo data loaded. Replace it with your own numbers.'
            : 'Your current numbers.'
        }
        meta={[
          { label: 'Updated', value: formatDate(data.settings.lastUpdated) },
          { label: 'Open lanes', value: `${totalOpenLanes}` },
          { label: 'Currency', value: data.settings.currency },
        ]}
      />

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Net position"
          value={formatCurrency(summary.netPosition, currency)}
          note={`${formatCompactCurrency(summary.totalInvestments, currency)} invested vs. ${formatCompactCurrency(summary.totalDebt, currency)} owed.`}
          icon={WalletCards}
        />
        <MetricCard
          title="Monthly inflow"
          value={formatCurrency(summary.monthlyIncome, currency)}
          note={`${data.incomes.length} income lanes feeding the month.`}
          icon={ArrowDownToLine}
        />
        <MetricCard
          title="Debt load"
          value={formatCurrency(summary.totalDebt, currency)}
          note={`Total principal and interest to be paid.`}
          icon={Landmark}
        />
        <MetricCard
          title="Goal pace"
          value={`${summary.goalProgress.toFixed(0)}%`}
          note={`${formatCurrency(summary.totalGoalCurrent, currency)} collected across active goals.`}
          icon={Target}
        />
      </section>

      {debtMonthlyTotals.length ? (
        <section className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-xs text-[var(--foreground-soft)]">
          <span className="mr-2 uppercase tracking-[0.12em] text-[var(--foreground-faint)]">
            Monthly debt payments:
          </span>
          {debtMonthlyTotals
            .map(
              (item) =>
                `${item.currency} ${formatCurrency(item.total, item.currency)}`,
            )
            .join(' · ')}
        </section>
      ) : null}

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <SectionTitle
              title="Next up"
              description="The three checkpoints that matter most right now."
              badge="Desk rhythm"
            />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="eyebrow text-[var(--foreground-faint)]">
                    Next debt due
                  </p>
                  <p className="mt-2 text-base font-semibold text-[var(--foreground)]">
                    {nextDebt ? nextDebt.name : 'No debts yet'}
                  </p>
                  <p className="mt-1 text-base text-[var(--foreground-soft)]">
                    {nextDebt
                      ? `${nextDebt.lender} · ${formatDate(nextDebt.dueDate)}`
                      : 'Add a balance to start tracking it here.'}
                  </p>
                </div>
                <p className="font-mono text-base text-[var(--foreground)]">
                  {nextDebt ? formatCurrency(nextDebt.balance, currency) : '--'}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="eyebrow text-[var(--foreground-faint)]">
                    Next income landing
                  </p>
                  <p className="mt-2 text-base font-semibold text-[var(--foreground)]">
                    {nextIncome ? nextIncome.name : 'No incomes yet'}
                  </p>
                  <p className="mt-1 text-base text-[var(--foreground-soft)]">
                    {nextIncome
                      ? `${nextIncome.source} · ${formatDate(nextIncome.nextDate)}`
                      : 'Add an income lane to see the next arrival.'}
                  </p>
                </div>
                <p className="font-mono text-base text-[var(--foreground)]">
                  {nextIncome
                    ? formatCurrency(nextIncome.amount, currency)
                    : '--'}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="eyebrow text-[var(--foreground-faint)]">
                    Closest goal checkpoint
                  </p>
                  <p className="mt-2 text-base font-semibold text-[var(--foreground)]">
                    {nextGoal ? nextGoal.name : 'No goals yet'}
                  </p>
                  <p className="mt-1 text-base text-[var(--foreground-soft)]">
                    {nextGoal
                      ? `${nextGoal.type} · ${formatDate(nextGoal.deadline)}`
                      : 'Set a target to bring the next milestone into view.'}
                  </p>
                </div>
                <p className="font-mono text-base text-[var(--foreground)]">
                  {nextGoal
                    ? formatCurrency(
                        Math.max(nextGoal.target - nextGoal.current, 0),
                        currency,
                      )
                    : '--'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionTitle
              title="Goal progress"
              description="Quiet progress bars instead of noisy charts."
              badge={`${data.goals.length} goals`}
            />
          </CardHeader>
          <CardContent className="space-y-4">
            {data.goals.length ? (
              data.goals.map((goal) => {
                const progress =
                  goal.target > 0 ? (goal.current / goal.target) * 100 : 0

                return (
                  <div key={goal.id} className="space-y-2">
                    <div className="flex items-center justify-between gap-3 text-base">
                      <div>
                        <p className="font-medium text-[var(--foreground)]">
                          {goal.name}
                        </p>
                        <p className="text-[var(--foreground-soft)]">
                          {formatCurrency(goal.current, currency)} of{' '}
                          {formatCurrency(goal.target, currency)}
                        </p>
                      </div>
                      <span className="font-mono text-[var(--foreground)]">
                        {progress.toFixed(0)}%
                      </span>
                    </div>
                    <Progress value={progress} />
                  </div>
                )
              })
            ) : (
              <p className="text-base leading-6 text-[var(--foreground-soft)]">
                Add your first goal to start tracking progress here.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <QuickLinkCard
          title="Debts"
          href="/debts"
          value={formatCompactCurrency(summary.totalDebt, currency)}
          note={`${data.debts.length} balances to pay off.`}
          summary={
            nextDebt
              ? `Next due ${formatDate(nextDebt.dueDate)}`
              : 'No balances yet'
          }
        />
        <QuickLinkCard
          title="Incomes"
          href="/incomes"
          value={formatCompactCurrency(summary.monthlyIncome, currency)}
          note={`${data.incomes.length} lanes converted into a monthly view.`}
          summary={
            nextIncome
              ? `Next landing ${formatDate(nextIncome.nextDate)}`
              : 'No income yet'
          }
        />
        <QuickLinkCard
          title="Investments"
          href="/investments"
          value={formatCompactCurrency(summary.totalInvestments, currency)}
          note={`${data.investments.length} positions with ${formatCurrency(summary.monthlyInvesting, currency)} added every month.`}
          summary={`${formatPercent(getAverageInvestmentChange(data.investments))} average change`}
        />
        <QuickLinkCard
          title="Goals"
          href="/goals"
          value={formatCompactCurrency(
            summary.totalGoalTarget - summary.totalGoalCurrent,
            currency,
          )}
          note={`${data.goals.length} active targets still needing attention.`}
          summary={
            nextGoal
              ? `Closest ${formatDate(nextGoal.deadline)}`
              : 'No targets yet'
          }
        />
      </section>

      <section className="mt-6">
        <Card>
          <CardHeader>
            <SectionTitle
              title="Recent entries"
              description="Newest balances, incomes, investments, and goals across the desk."
              badge="Latest six"
            />
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Meta</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.length ? (
                  recent.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-[var(--foreground)]">
                            {item.label}
                          </p>
                          <p className="text-xs text-[var(--foreground-faint)]">
                            Added {formatDate(item.createdAt)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={currencyVariant(item.kind)}>
                          {item.kind}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[var(--foreground-soft)]">
                        {item.meta}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(item.amount, currency)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <EmptyRow
                    colSpan={4}
                    message="Your recent entries will show up here."
                  />
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
