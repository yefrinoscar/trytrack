import { Coins, PiggyBank, TrendingUp, Trash2 } from 'lucide-react'
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
import { InvestmentForm } from '@/features/finance/forms'
import {
  EmptyRow,
  FinancePageState,
  MetricCard,
  PageIntro,
  SectionTitle,
} from '@/features/finance/shared'
import type { FinanceActions } from '@/features/finance/shared'
import {
  formatCurrency,
  formatPercent,
  getAverageInvestmentChange,
} from '@/lib/finance'
import type { DashboardData } from '@/lib/finance'

export function InvestmentsPage() {
  return (
    <FinancePageState>
      {(data, actions) => <InvestmentsView actions={actions} data={data} />}
    </FinancePageState>
  )
}

function InvestmentsView({
  data,
  actions,
}: {
  data: DashboardData
  actions: FinanceActions
}) {
  const currency = data.settings.currency
  const investments = useMemo(
    () =>
      [...data.investments].sort(
        (left, right) => right.currentValue - left.currentValue,
      ),
    [data.investments],
  )
  const totalValue = investments.reduce(
    (sum, item) => sum + item.currentValue,
    0,
  )
  const monthlyContribution = investments.reduce(
    (sum, item) => sum + item.monthlyContribution,
    0,
  )
  const averageChange = getAverageInvestmentChange(investments)

  return (
    <main className="page-wrap px-4 pb-16">
      <PageIntro
        eyebrow="Investments"
        title="Investments"
        description="Value, monthly contributions, and change."
        meta={[
          { label: 'Positions', value: `${investments.length}` },
          {
            label: 'Monthly adds',
            value: formatCurrency(monthlyContribution, currency),
          },
          { label: 'Average change', value: formatPercent(averageChange) },
        ]}
      />

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <MetricCard
          title="Portfolio value"
          value={formatCurrency(totalValue, currency)}
          note="Current value across every investment lane."
          icon={TrendingUp}
        />
        <MetricCard
          title="Monthly contribution"
          value={formatCurrency(monthlyContribution, currency)}
          note="What you are feeding into the long game every month."
          icon={PiggyBank}
        />
        <MetricCard
          title="Average move"
          value={formatPercent(averageChange)}
          note="Simple average of change percentages stored for each position."
          icon={Coins}
        />
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.45fr_0.95fr]">
        <Card>
          <CardHeader>
            <SectionTitle
              title="Investment lanes"
              description="Largest values surface first, so the biggest holdings stay visible."
              badge={`${investments.length} rows`}
            />
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Investment</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">Monthly</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                  <TableHead className="text-right">&nbsp;</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {investments.length ? (
                  investments.map((investment) => (
                    <TableRow key={investment.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-[var(--foreground)]">
                            {investment.name}
                          </p>
                          <p className="text-xs text-[var(--foreground-faint)]">
                            {investment.account}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="success">{investment.type}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(investment.currentValue, currency)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(
                          investment.monthlyContribution,
                          currency,
                        )}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono ${investment.changePct >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}
                      >
                        {formatPercent(investment.changePct)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          className="h-8 w-8"
                          size="icon"
                          variant="ghost"
                          onClick={() =>
                            void actions.removeItem({
                              kind: 'investments',
                              id: investment.id,
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
                    message="Add your first investment lane to start the board."
                  />
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Add investment</CardTitle>
              <CardDescription>
                A simple lane for value, contribution, and a rough change
                number.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InvestmentForm
                busy={actions.isWorking}
                onSubmit={(value) =>
                  actions.createItem({ kind: 'investments', value })
                }
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Keep it lightweight</CardTitle>
              <CardDescription>
                This is a dashboard, not a market terminal. Only store what
                helps you decide.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-base leading-6 text-[var(--foreground-soft)]">
              <p>
                Use one row per bucket or account, not every holding if that
                feels noisy.
              </p>
              <p>
                Track contribution pace here and detailed allocations elsewhere
                if needed.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  )
}
