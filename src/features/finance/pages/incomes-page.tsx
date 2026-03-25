import {
  ArrowDownToLine,
  CalendarClock,
  CircleDollarSign,
  Trash2,
} from 'lucide-react'
import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { IncomeForm } from '@/features/finance/forms'
import {
  EmptyRow,
  FinancePageState,
  MetricCard,
  PageIntro,
  SectionTitle,
  sortByDateAscending,
} from '@/features/finance/shared'
import type { FinanceActions } from '@/features/finance/shared'
import {
  formatCurrency,
  formatDate,
  getMonthlyIncomeAmount,
  getSoonestDate,
} from '@/lib/finance'
import type { DashboardData } from '@/lib/finance'

export function IncomesPage() {
  return (
    <FinancePageState>
      {(data, actions) => <IncomesView actions={actions} data={data} />}
    </FinancePageState>
  )
}

function IncomesView({
  data,
  actions,
}: {
  data: DashboardData
  actions: FinanceActions
}) {
  const currency = data.settings.currency
  const incomes = useMemo(
    () => sortByDateAscending(data.incomes, (item) => item.nextDate),
    [data.incomes],
  )
  const monthlyTotal = incomes.reduce(
    (sum, income) => sum + getMonthlyIncomeAmount(income),
    0,
  )
  const recurringCount = incomes.filter(
    (income) => income.frequency !== 'One-time',
  ).length
  const nextDate = getSoonestDate(incomes.map((income) => income.nextDate))

  return (
    <main className="page-wrap px-4 pb-16">
      <PageIntro
        eyebrow="Incomes"
        title="Income"
        description="Incoming money and monthly equivalents."
        meta={[
          { label: 'Lanes', value: `${incomes.length}` },
          { label: 'Recurring', value: `${recurringCount}` },
          {
            label: 'Next arrival',
            value: nextDate ? formatDate(nextDate) : '--',
          },
        ]}
      />

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <MetricCard
          title="Monthly equivalent"
          value={formatCurrency(monthlyTotal, currency)}
          note="Every income lane translated into a comparable monthly figure."
          icon={CircleDollarSign}
        />
        <MetricCard
          title="Largest lane"
          value={
            incomes.length
              ? formatCurrency(
                  Math.max(...incomes.map((income) => income.amount)),
                  currency,
                )
              : '--'
          }
          note="The highest single payout currently on file."
          icon={ArrowDownToLine}
        />
        <MetricCard
          title="Next arrival"
          value={nextDate ? formatDate(nextDate) : '--'}
          note="The soonest scheduled payout on the board."
          icon={CalendarClock}
        />
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.45fr_0.95fr]">
        <Card>
          <CardHeader>
            <SectionTitle
              title="Income lanes"
              description="Sorted by next arrival so the calendar stays easy to scan."
              badge={`${incomes.length} rows`}
            />
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Income</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Monthly view</TableHead>
                  <TableHead>Next date</TableHead>
                  <TableHead className="text-right">&nbsp;</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incomes.length ? (
                  incomes.map((income) => (
                    <TableRow key={income.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-[var(--foreground)]">
                            {income.name}
                          </p>
                          <p className="text-xs text-[var(--foreground-faint)]">
                            {income.source}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="success">{income.frequency}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(income.amount, currency)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(
                          getMonthlyIncomeAmount(income),
                          currency,
                        )}
                      </TableCell>
                      <TableCell>{formatDate(income.nextDate)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          className="h-8 w-8"
                          size="icon"
                          variant="ghost"
                          onClick={() =>
                            void actions.removeItem({
                              kind: 'incomes',
                              id: income.id,
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <EmptyRow
                    colSpan={6}
                    message="Add your first income lane to see it here."
                  />
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Add income</CardTitle>
              <CardDescription>
                Recurring or one-time, as long as it lands here.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IncomeForm
                busy={actions.isWorking}
                onSubmit={(value) =>
                  actions.createItem({ kind: 'incomes', value })
                }
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Why monthly view?</CardTitle>
              <CardDescription>
                It keeps weekly, quarterly, and yearly income on the same page
                without extra math.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-base leading-6 text-[var(--foreground-soft)]">
              <p>
                Use short labels for each lane, and store the real source in the
                second field.
              </p>
              <p>
                Quarterly and yearly payments still matter; this just makes them
                comparable.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  )
}
