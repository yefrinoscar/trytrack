import { CalendarClock, ShieldCheck, Target, Trash2 } from 'lucide-react'
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
import { Progress } from '@/components/ui/progress'
import { GoalForm } from '@/features/finance/forms'
import {
  FinancePageState,
  MetricCard,
  PageIntro,
  SectionTitle,
  type FinanceActions,
  sortByDateAscending,
} from '@/features/finance/shared'
import { formatCurrency, formatDate, getSoonestDate } from '@/lib/finance'
import type { DashboardData } from '@/lib/finance'

export function GoalsPage() {
  return (
    <FinancePageState>
      {(data, actions) => <GoalsView actions={actions} data={data} />}
    </FinancePageState>
  )
}

function GoalsView({
  data,
  actions,
}: {
  data: DashboardData
  actions: FinanceActions
}) {
  const currency = data.settings.currency
  const goals = useMemo(
    () => sortByDateAscending(data.goals, (item) => item.deadline),
    [data.goals],
  )
  const funded = goals.reduce((sum, goal) => sum + goal.current, 0)
  const target = goals.reduce((sum, goal) => sum + goal.target, 0)
  const remaining = Math.max(target - funded, 0)
  const closestDeadline = getSoonestDate(goals.map((goal) => goal.deadline))

  return (
    <main className="page-wrap px-4 pb-16 pt-10">
      <PageIntro
        eyebrow="Goals"
        title="Goals"
        description="Targets, progress, and deadlines."
        meta={[
          { label: 'Targets', value: `${goals.length}` },
          { label: 'Funded', value: formatCurrency(funded, currency) },
          {
            label: 'Closest',
            value: closestDeadline ? formatDate(closestDeadline) : '--',
          },
        ]}
      />

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <MetricCard
          title="Funded so far"
          value={formatCurrency(funded, currency)}
          note="What is already sitting inside the active goal pool."
          icon={ShieldCheck}
        />
        <MetricCard
          title="Still needed"
          value={formatCurrency(remaining, currency)}
          note="The remaining gap across every active target."
          icon={Target}
        />
        <MetricCard
          title="Closest deadline"
          value={closestDeadline ? formatDate(closestDeadline) : '--'}
          note="The nearest goal checkpoint on the calendar."
          icon={CalendarClock}
        />
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.45fr_0.95fr]">
        <Card>
          <CardHeader>
            <SectionTitle
              title="Active targets"
              description="Sorted by deadline so soonest targets stay closest to eye level."
              badge={`${goals.length} rows`}
            />
          </CardHeader>
          <CardContent className="space-y-4">
            {goals.length ? (
              goals.map((goal) => {
                const progress =
                  goal.target > 0 ? (goal.current / goal.target) * 100 : 0

                return (
                  <div
                    key={goal.id}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-[var(--foreground)]">
                            {goal.name}
                          </p>
                          <Badge>{goal.type}</Badge>
                        </div>
                        <p className="mt-1 text-base text-[var(--foreground-soft)]">
                          Due {formatDate(goal.deadline)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 sm:justify-end">
                        <span className="font-mono text-base text-[var(--foreground)]">
                          {formatCurrency(goal.current, currency)} /{' '}
                          {formatCurrency(goal.target, currency)}
                        </span>
                        <Button
                          className="h-8 w-8"
                          size="icon"
                          variant="ghost"
                          onClick={() =>
                            void actions.removeItem({
                              kind: 'goals',
                              id: goal.id,
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      <Progress value={progress} />
                      <div className="flex items-center justify-between text-xs uppercase tracking-[0.12em] text-[var(--foreground-faint)]">
                        <span>{progress.toFixed(0)}% funded</span>
                        <span>
                          {formatCurrency(
                            Math.max(goal.target - goal.current, 0),
                            currency,
                          )}{' '}
                          left
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-10 text-center text-base text-[var(--foreground-soft)]">
                Add a goal to start tracking its progress here.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Add goal</CardTitle>
              <CardDescription>
                Name the target, set the number, and give it a date so it stays
                real.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <GoalForm
                busy={actions.isWorking}
                onSubmit={(value) =>
                  actions.createItem({ kind: 'goals', value })
                }
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>One useful habit</CardTitle>
              <CardDescription>
                Keep goal names outcome-based. If you can read the row and
                instantly know the win, it is working.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-base leading-6 text-[var(--foreground-soft)]">
              <p>
                Use separate goals for emergency cash, debt payoff, and
                investing milestones.
              </p>
              <p>
                Let deadline order create urgency instead of adding more
                notifications.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  )
}
