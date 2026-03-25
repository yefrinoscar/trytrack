import { useMemo, useState } from 'react'
import { CircleSlash, MoreVertical, Pencil, Play, Trash2 } from 'lucide-react'
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
import { RecurringPaymentForm } from '@/features/finance/forms'
import {
  AnimatedCurrencyValue,
  sortByDateAscending,
} from '@/features/finance/shared'
import type { FinanceActions } from '@/features/finance/shared'
import type { RecurringPayment } from '@/lib/finance'

interface RecurringPaymentsColumnProps {
  recurringPayments: RecurringPayment[]
  defaultCurrency: string
  actions: FinanceActions
}

export function RecurringPaymentsColumn({
  recurringPayments,
  defaultCurrency,
  actions,
}: RecurringPaymentsColumnProps) {
  const [showPaymentSheet, setShowPaymentSheet] = useState(false)
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null)

  const sortedRecurringPayments = useMemo(
    () => sortByDateAscending(recurringPayments, (item) => item.startDate),
    [recurringPayments],
  )

  const recurringPaymentSections = useMemo(() => {
    const sortPayments = (items: RecurringPayment[]) =>
      [...items].sort((left, right) => {
        const dueDayDiff = (left.dueDay ?? 1) - (right.dueDay ?? 1)

        if (dueDayDiff !== 0) {
          return dueDayDiff
        }

        return (
          new Date(left.startDate).getTime() -
          new Date(right.startDate).getTime()
        )
      })

    const active = sortedRecurringPayments.filter(
      (payment) => payment.status === 'active',
    )
    const paused = sortedRecurringPayments.filter(
      (payment) => payment.status === 'paused',
    )
    const cancelled = sortedRecurringPayments.filter(
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
  }, [sortedRecurringPayments])

  const editingPayment =
    recurringPayments.find((payment) => payment.id === editingPaymentId) ?? null

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
    <div className="inline-block align-top w-[320px] rounded-[1.1rem] border border-[var(--border)] bg-[var(--panel)] p-3 sm:p-3.5">
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
                {editingPayment
                  ? 'Edit recurring payment'
                  : 'New recurring payment'}
              </SheetTitle>
              <SheetDescription>
                {editingPayment
                  ? 'Update amount, dates, currency, or status.'
                  : 'Add a recurring payment in a few fields.'}
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6">
              <RecurringPaymentForm
                busy={actions.isWorking}
                defaultCurrency={defaultCurrency}
                initialValue={editingPayment}
                submitLabel={editingPayment ? 'Save changes' : 'Add payment'}
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

      {recurringPaymentSections.length ? (
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
  )
}
