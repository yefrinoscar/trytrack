import { CircleSlash, MoreVertical, Pencil, Play, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { DebtForm, RecurringPaymentForm } from '@/features/finance/forms'
import {
  AnimatedCurrencyValue,
  DebtProjectionChart,
  FinancePageState,
  type FinanceActions,
  sortByDateAscending,
} from '@/features/finance/shared'
import {
  formatCurrency,
  getDebtMonthlyPayment,
  getDebtProjection,
  type RecurringPayment,
} from '@/lib/finance'
import type { DashboardData } from '@/lib/finance'

export function DebtsPage() {
  return (
    <FinancePageState>
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
  const [showNewDebt, setShowNewDebt] = useState(false)
  const [editingDebtId, setEditingDebtId] = useState<string | null>(null)
  const [currencyView, setCurrencyView] = useState(defaultCurrency)
  const [showPaymentSheet, setShowPaymentSheet] = useState(false)
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null)
  const debts = useMemo(
    () => sortByDateAscending(data.debts, (item) => item.dueDate),
    [data.debts],
  )
  const debtCurrencies = useMemo(() => {
    const values = new Set(debts.map((debt) => debt.currency))
    values.add(defaultCurrency)
    return [...values].sort((left, right) => left.localeCompare(right))
  }, [debts, defaultCurrency])
  const debtScope = useMemo(
    () => debts.filter((debt) => debt.currency === currencyView),
    [currencyView, debts],
  )
  const totalBalance = debtScope.reduce((sum, debt) => sum + debt.balance, 0)
  const monthlyDebtPayment = debtScope.reduce(
    (sum, debt) => sum + getDebtMonthlyPayment(debt.balance, debt.payments),
    0,
  )
  const recurringPayments = useMemo(
    () => sortByDateAscending(data.recurringPayments, (item) => item.startDate),
    [data.recurringPayments],
  )
  const recurringPaymentSections = useMemo(() => {
    const sortPayments = (items: RecurringPayment[]) =>
      [...items].sort((left, right) => {
        const dueDayDiff = (left.dueDay ?? 1) - (right.dueDay ?? 1)

        if (dueDayDiff !== 0) {
          return dueDayDiff
        }

        return (
          new Date(left.startDate).getTime() - new Date(right.startDate).getTime()
        )
      })

    const active = recurringPayments.filter((payment) => payment.status === 'active')
    const paused = recurringPayments.filter((payment) => payment.status === 'paused')
    const cancelled = recurringPayments.filter(
      (payment) => payment.status === 'cancelled',
    )

    return [
      {
        key: 'active',
        title: 'Active',
        description: 'Included in monthly totals.',
        labelClassName:
          'bg-[color-mix(in_srgb,var(--success)_14%,transparent)] text-[var(--success)]',
        items: sortPayments(active),
      },
      {
        key: 'paused',
        title: 'Paused',
        description: 'Temporarily excluded until reactivated.',
        labelClassName:
          'bg-[color-mix(in_srgb,var(--warning)_16%,transparent)] text-[var(--warning)]',
        items: sortPayments(paused),
      },
      {
        key: 'cancelled',
        title: 'Cancelled',
        description: 'Kept as history and shown last.',
        labelClassName:
          'bg-[color-mix(in_srgb,var(--danger)_14%,transparent)] text-[var(--danger)]',
        items: sortPayments(cancelled),
      },
    ].filter((section) => section.items.length > 0)
  }, [recurringPayments])
  const activeRecurringPayments = useMemo(
    () => recurringPayments.filter((payment) => payment.status === 'active'),
    [recurringPayments],
  )
  const recurringPaymentsInCurrency = useMemo(
    () =>
      activeRecurringPayments.filter(
        (payment) => payment.currency === currencyView,
      ),
    [activeRecurringPayments, currencyView],
  )
  const totalRecurringMonthly = recurringPaymentsInCurrency.reduce(
    (sum, payment) => sum + payment.amount,
    0,
  )
  const projection = useMemo(() => getDebtProjection(debtScope), [debtScope])
  const monthlyPlanRowsByDebtId = useMemo(() => {
    const map = new Map<string, Array<{ key: string; payment: number }>>()

    debtScope.forEach((debt) => {
      const plannedInstallments = Math.max(1, Math.round(debt.payments || 1))
      const installmentPayment = debt.balance / plannedInstallments
      const rows: Array<{ key: string; payment: number }> = []

      for (let i = 0; i < plannedInstallments; i++) {
        rows.push({
          key: `planned-${debt.id}-${i}`,
          payment: installmentPayment,
        })
      }

      if (rows.length > 0) {
        map.set(debt.id, rows)
      }
    })

    return map
  }, [debtScope])
  const editingDebt = debts.find((debt) => debt.id === editingDebtId) ?? null
  const editingPayment =
    data.recurringPayments.find((payment) => payment.id === editingPaymentId) ??
    null

  useEffect(() => {
    if (!debtCurrencies.includes(currencyView)) {
      setCurrencyView(debtCurrencies[0] ?? defaultCurrency)
    }
  }, [currencyView, debtCurrencies, defaultCurrency])

  function openNewDebtForm() {
    setEditingDebtId(null)
    setShowNewDebt(true)
  }

  function openEditDebtForm(debtId: string) {
    setEditingDebtId(debtId)
    setShowNewDebt(true)
  }

  function closeDebtForm() {
    setShowNewDebt(false)
    setEditingDebtId(null)
  }

  function openNewRecurringForm() {
    setEditingPaymentId(null)
    setShowPaymentSheet(true)
  }

  function openEditRecurringForm(paymentId: string) {
    setEditingPaymentId(paymentId)
    setShowPaymentSheet(true)
  }

  function closeRecurringForm() {
    setShowPaymentSheet(false)
    setEditingPaymentId(null)
  }

  return (
    <main className="page-wrap flex flex-1 flex-col pb-4 pt-16">
      <section className="grid items-start gap-3 xl:grid-cols-3">
        {/* Column 1: Debt Table */}
        <div className="flex flex-col rounded-[1.1rem] border border-[var(--border)] bg-[var(--panel)] p-3 sm:p-3.5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="eyebrow">Debts</p>
              <h2 className="mt-1 text-base font-semibold tracking-tight text-[var(--foreground)]">
                Debt details
              </h2>
            </div>
            <Button
              size="sm"
              variant={showNewDebt ? 'outline' : 'secondary'}
              onClick={showNewDebt ? closeDebtForm : openNewDebtForm}
            >
              {showNewDebt ? 'Close' : 'New'}
            </Button>
          </div>

          {debtScope.length ? (
            <div className="space-y-2">
              {debtScope.map((debt) => {
                const installmentRows =
                  monthlyPlanRowsByDebtId.get(debt.id) ?? []
                const actualInstallments = installmentRows.length
                const plannedInstallments = Math.max(
                  1,
                  Math.round(debt.payments || 1),
                )

                {
                  const dueDateObj = new Date(debt.dueDate + 'T00:00:00')
                  const dueMonth = dueDateObj
                    .toLocaleString('en', { month: 'short' })
                    .toUpperCase()
                  const dueDay = dueDateObj.getDate()

                  return (
                    <div
                      key={debt.id}
                      className="cursor-pointer rounded-lg bg-[var(--surface-muted)] p-2.5 transition-colors hover:bg-[var(--panel-elevated)]"
                      onClick={() => openEditDebtForm(debt.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          openEditDebtForm(debt.id)
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="flex items-start gap-3 mb-2">
                        <div className="flex min-w-[44px] flex-col items-center justify-center rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--warning)_16%,var(--panel))] px-2 py-1.5">
                          <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--warning)]">
                            {dueMonth}
                          </span>
                          <span className="text-lg font-bold leading-tight text-[var(--foreground)]">
                            {dueDay}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-base font-medium text-[var(--foreground)] truncate">
                            {debt.name}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[var(--foreground-faint)]">
                            <span>
                              {debt.lender} · {debt.type}
                            </span>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              className="h-6 w-6"
                              size="icon"
                              variant="ghost"
                              onClick={(event) => event.stopPropagation()}
                              onPointerDown={(event) => event.stopPropagation()}
                            >
                              <MoreVertical className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <DropdownMenuItem
                              onClick={(event) => {
                                event.stopPropagation()
                                openEditDebtForm(debt.id)
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                              Edit debt
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(event) => {
                                event.stopPropagation()
                                void actions.removeItem({
                                  kind: 'debts',
                                  id: debt.id,
                                })
                              }}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete debt
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="ml-[56px] mb-2 space-y-1.5 text-sm">
                        <div className="flex justify-between">
                          <span className="text-[var(--foreground-soft)]">
                            Balance
                          </span>
                          <AnimatedCurrencyValue
                            className="font-mono text-[var(--foreground)]"
                            currency={debt.currency}
                            value={debt.balance}
                          />
                        </div>
                      </div>
                      <div className="ml-[56px] border-t border-[var(--border)] pt-2">
                        <p className="mb-2 text-sm font-semibold tracking-tight text-[var(--foreground-soft)]">
                          Installments ({actualInstallments} payments)
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {installmentRows.length ? (
                            installmentRows.map((row, index) => (
                              <div
                                key={row.key}
                                className="inline-flex items-center gap-1 rounded-md bg-[color-mix(in_srgb,var(--warning)_20%,transparent)] px-2 py-1 text-xs font-semibold text-[var(--warning)]"
                              >
                                {index + 1}/{actualInstallments}{' '}
                                {formatCurrency(row.payment, currencyView)}
                              </div>
                            ))
                          ) : (
                            <span className="text-xs text-[var(--foreground-soft)]">
                              {plannedInstallments} planned installments
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                }
              })}
            </div>
          ) : (
            <div className="rounded-lg border-dashed p-4 text-center text-base text-[var(--foreground-soft)] opacity-50">
              No debts in {currencyView}. Click New to add one.
            </div>
          )}
        </div>

        {/* Column 2: Recurring Payments */}
        <div className="flex flex-col rounded-[1.1rem] border border-[var(--border)] bg-[var(--panel)] p-3 sm:p-3.5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="eyebrow">Recurring Payments</p>
              <h2 className="mt-1 text-base font-semibold tracking-tight text-[var(--foreground)]">
                Monthly subscriptions
              </h2>
            </div>
            <Sheet
              open={showPaymentSheet}
              onOpenChange={(open) => {
                if (!open) {
                  closeRecurringForm()
                  return
                }

                setShowPaymentSheet(true)
              }}
            >
              <SheetTrigger asChild>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={openNewRecurringForm}
                >
                  New
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-md">
                <SheetHeader>
                  <SheetTitle>
                    {editingPaymentId
                      ? 'Edit recurring payment'
                      : 'New recurring payment'}
                  </SheetTitle>
                  <SheetDescription>
                    {editingPaymentId
                      ? 'Update amount, dates, currency, or status.'
                      : 'Add a recurring payment in a few fields.'}
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-6">
                  <RecurringPaymentForm
                    busy={actions.isWorking}
                    defaultCurrency={defaultCurrency}
                    initialValue={editingPayment}
                    submitLabel={
                      editingPayment ? 'Save changes' : 'Add payment'
                    }
                    onCancel={closeRecurringForm}
                    onSubmit={async (value) => {
                      if (editingPayment) {
                        await actions.updateRecurringPayment({
                          id: editingPayment.id,
                          value,
                        })
                      } else {
                        await actions.createRecurringPayment(value)
                      }

                      closeRecurringForm()
                    }}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {recurringPayments.length ? (
            <div className="space-y-4">
              {recurringPaymentSections.map((section) => (
                <section key={section.key} className="space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold tracking-tight text-[var(--foreground)]">
                          {section.title}
                        </h3>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${section.labelClassName}`}
                        >
                          {section.items.length}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[var(--foreground-soft)]">
                        {section.description}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {section.items.map((payment) => {
                      const now = new Date()
                      const dueDayNum = payment.dueDay ?? 1
                      const nextDueDate = new Date(
                        now.getFullYear(),
                        now.getMonth(),
                        dueDayNum,
                      )
                      if (nextDueDate < now) {
                        nextDueDate.setMonth(nextDueDate.getMonth() + 1)
                      }
                      const pMonth = nextDueDate
                        .toLocaleString('en', { month: 'short' })
                        .toUpperCase()
                      const pDay = dueDayNum
                      const isPaused = payment.status === 'paused'
                      const isCancelled = payment.status === 'cancelled'
                      const paymentCardClassName = isCancelled
                        ? 'bg-[color-mix(in_srgb,var(--danger)_7%,var(--surface-muted))] opacity-55 hover:bg-[color-mix(in_srgb,var(--danger)_10%,var(--surface-muted))] hover:opacity-70'
                        : isPaused
                          ? 'bg-[color-mix(in_srgb,var(--warning)_10%,var(--surface-muted))] opacity-85 hover:bg-[color-mix(in_srgb,var(--warning)_14%,var(--surface-muted))] hover:opacity-100'
                          : 'bg-[var(--surface-muted)] hover:bg-[var(--panel-elevated)]'
                      const paymentDateClassName = isCancelled
                        ? 'bg-[color-mix(in_srgb,var(--danger)_12%,var(--panel))]'
                        : isPaused
                          ? 'bg-[color-mix(in_srgb,var(--warning)_16%,var(--panel))]'
                          : 'bg-[color-mix(in_srgb,var(--success)_16%,var(--panel))]'
                      const paymentMonthClassName = isCancelled
                        ? 'text-[var(--danger)]'
                        : isPaused
                          ? 'text-[var(--warning)]'
                          : 'text-[var(--success)]'

                      return (
                        <div
                          key={payment.id}
                          className={`cursor-pointer rounded-lg p-2.5 transition-colors ${paymentCardClassName}`}
                          onClick={() => openEditRecurringForm(payment.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              openEditRecurringForm(payment.id)
                            }
                          }}
                          role="button"
                          tabIndex={0}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex min-w-[44px] flex-col items-center justify-center rounded-lg px-2 py-1.5 ${paymentDateClassName}`}
                            >
                              <span
                                className={`text-[9px] font-semibold uppercase tracking-wider ${paymentMonthClassName}`}
                              >
                                {pMonth}
                              </span>
                              <span className="text-lg font-bold leading-tight text-[var(--foreground)]">
                                {pDay}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-base font-medium text-[var(--foreground)]">
                                {payment.name}
                              </p>
                              <p className="mt-0.5 text-xs text-[var(--foreground-faint)]">
                                {payment.category}
                              </p>
                            </div>
                            <AnimatedCurrencyValue
                              className={`self-center font-mono text-base ${isCancelled ? 'text-[var(--foreground-soft)]' : 'text-[var(--foreground)]'}`}
                              currency={payment.currency}
                              value={payment.amount}
                            />
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  className="h-6 w-6 self-center"
                                  size="icon"
                                  variant="ghost"
                                  onClick={(event) => event.stopPropagation()}
                                  onPointerDown={(event) =>
                                    event.stopPropagation()
                                  }
                                >
                                  <MoreVertical className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <DropdownMenuItem
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    openEditRecurringForm(payment.id)
                                  }}
                                >
                                  <Pencil className="h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-[var(--danger)]"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    void actions.updateRecurringPayment({
                                      id: payment.id,
                                      value: {
                                        status: 'cancelled',
                                      },
                                    })
                                  }}
                                  disabled={isCancelled}
                                >
                                  <CircleSlash className="h-4 w-4" />
                                  Cancel recurring payment
                                </DropdownMenuItem>
                                {isPaused || isCancelled ? (
                                  <DropdownMenuItem
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      void actions.updateRecurringPayment({
                                        id: payment.id,
                                        value: {
                                          status: 'active',
                                        },
                                      })
                                    }}
                                  >
                                    <Play className="h-4 w-4" />
                                    {isCancelled ? 'Reactivate' : 'Set active'}
                                  </DropdownMenuItem>
                                ) : null}
                                {isCancelled ? (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-[var(--danger)]"
                                      onClick={(event) => {
                                        event.stopPropagation()
                                        void actions.removeRecurringPayment(
                                          payment.id,
                                        )
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      Delete payment
                                    </DropdownMenuItem>
                                  </>
                                ) : null}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="rounded-lg bg-[var(--surface-muted)] p-3">
                <p className="text-xs text-[var(--foreground-faint)]">
                  No recurring payments added yet.
                </p>
                <p className="mt-1 text-xs text-[var(--foreground-soft)]">
                  Click New to register your subscriptions and monthly bills.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Column 3: Summary */}
        <div className="flex flex-col rounded-[1.1rem] border border-[var(--border)] bg-[var(--panel)] p-3 sm:p-3.5">
          <div className="mb-3">
            <p className="eyebrow">Summary</p>
            <h2 className="mt-1 text-base font-semibold tracking-tight text-[var(--foreground)]">
              Complete overview
            </h2>
          </div>

          <DebtProjectionChart currency={currencyView} points={projection} />

          <div className="mt-3 space-y-3">
            <div className="rounded-lg bg-[var(--surface-muted)] p-2.5">
              <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--foreground-faint)] mb-2">
                Monthly Payments
              </p>
              <div className="space-y-1.5 text-xs">
                {debtScope.length ? (
                  debtScope.map((debt) => {
                    const monthlyPayment = getDebtMonthlyPayment(
                      debt.balance,
                      debt.payments,
                    )
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
                    <span className="text-[var(--foreground-soft)]">
                      No debts
                    </span>
                    <span className="font-mono text-[var(--foreground)]">
                      --
                    </span>
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
                    <span className="font-mono text-[var(--foreground)]">
                      --
                    </span>
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
                  <span className="text-[var(--foreground-soft)]">
                    All debts
                  </span>
                  <AnimatedCurrencyValue
                    className="font-mono text-[var(--foreground)]"
                    currency={currencyView}
                    value={totalBalance}
                  />
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--foreground-soft)]">
                    All recurring
                  </span>
                  <AnimatedCurrencyValue
                    className="font-mono text-[var(--foreground)]"
                    currency={currencyView}
                    value={totalRecurringMonthly}
                  />
                </div>
                <div className="flex justify-between border-t border-[var(--border)] pt-1.5 mt-1.5 font-semibold">
                  <span className="text-[var(--foreground)]">
                    Combined monthly
                  </span>
                  <AnimatedCurrencyValue
                    className="font-mono text-[var(--warning)]"
                    currency={currencyView}
                    value={monthlyDebtPayment + totalRecurringMonthly}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Sheet
        open={showNewDebt}
        onOpenChange={(open) => !open && closeDebtForm()}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>
              {editingDebt ? 'Edit Debt' : 'Add New Debt'}
            </SheetTitle>
            <SheetDescription>
              {editingDebt
                ? 'Update your debt information and payment details.'
                : 'Enter your debt details to start tracking payments and payoff timeline.'}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <DebtForm
              busy={actions.isWorking}
              defaultCurrency={currencyView}
              initialValue={editingDebt}
              submitLabel={editingDebt ? 'Update debt' : 'Save debt'}
              onCancel={closeDebtForm}
              onSubmit={async (value) => {
                if (editingDebt) {
                  await actions.updateDebt({ id: editingDebt.id, value })
                } else {
                  await actions.createItem({ kind: 'debts', value })
                }

                closeDebtForm()
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </main>
  )
}
