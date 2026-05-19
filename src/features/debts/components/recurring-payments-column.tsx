import { useMemo } from 'react'
import { CircleSlash, MoreVertical, Pencil, Play, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { RecurringPaymentEditor } from './recurring-payment-form'
import {
  AnimatedCurrencyValue,
  sortByDateAscending,
} from '@/features/finance/shared'
import type { FinanceActions } from '@/features/finance/shared'
import type { RecurringPayment } from '@/lib/finance'
import { useRecurringPaymentsColumn } from '../hooks/use-recurring-payments-column'
import { recurringPaymentToDraft } from '../utils/recurring-payment-draft'

interface RecurringPaymentsColumnProps {
  recurringPayments: RecurringPayment[]
  defaultCurrency: string
  enabledCurrencies: string[]
  actions: FinanceActions
}

export function RecurringPaymentsColumn({
  recurringPayments,
  defaultCurrency,
  enabledCurrencies,
  actions,
}: RecurringPaymentsColumnProps) {
  const {
    cancelPayment,
    closeCreateForm,
    closeEditForm,
    commitEditField,
    createError,
    createInitialDraft,
    editingPayment,
    editingPaymentId,
    openCreateForm,
    openEditForm,
    reactivatePayment,
    removePayment,
    showCreateForm,
    submitCreatePayment,
  } = useRecurringPaymentsColumn({
    actions,
    recurringPayments,
    defaultCurrency,
    enabledCurrencies,
  })

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
          'bg-[color-mix(in_srgb,var(--success)_14%,transparent)] text-success',
        items: sortPayments(active),
      },
      {
        key: 'paused',
        title: 'Paused',
        description: 'Temporarily excluded until reactivated.',
        labelClassName:
          'bg-[color-mix(in_srgb,var(--warning)_16%,transparent)] text-warning',
        items: sortPayments(paused),
      },
      {
        key: 'cancelled',
        title: 'Cancelled',
        description: 'Kept as history and shown last.',
        labelClassName:
          'bg-[color-mix(in_srgb,var(--danger)_14%,transparent)] text-danger',
        items: sortPayments(cancelled),
      },
    ].filter((section) => section.items.length > 0)
  }, [sortedRecurringPayments])

  return (
    <div className="w-full rounded-[1.1rem] border border-border bg-card p-3 sm:p-3.5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="eyebrow">Recurring Payments</p>
          <h2 className="mt-1 text-base font-semibold tracking-tight text-foreground">
            Monthly subscriptions
          </h2>
        </div>
        <button
          type="button"
          className="inline-flex h-8 items-center justify-center rounded-md border border-border px-3 text-sm font-medium transition hover:bg-muted"
          onClick={showCreateForm ? closeCreateForm : openCreateForm}
        >
          {showCreateForm ? 'Close' : 'New'}
        </button>
      </div>

      {recurringPaymentSections.length ? (
        <div className="space-y-4">
          {recurringPaymentSections.map((section) => (
            <section key={section.key} className="space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold tracking-tight text-foreground">
                      {section.title}
                    </h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${section.labelClassName}`}
                    >
                      {section.items.length}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
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
                      : 'bg-muted hover:bg-popover'
                  const paymentDateClassName = isCancelled
                    ? 'bg-[color-mix(in_srgb,var(--danger)_12%,var(--panel))]'
                    : isPaused
                      ? 'bg-[color-mix(in_srgb,var(--warning)_16%,var(--panel))]'
                      : 'bg-[color-mix(in_srgb,var(--success)_16%,var(--panel))]'
                  const paymentMonthClassName = isCancelled
                    ? 'text-danger'
                    : isPaused
                      ? 'text-warning'
                      : 'text-success'

                  return (
                    <div
                      key={payment.id}
                      className={`cursor-pointer rounded-lg p-2.5 transition-colors ${paymentCardClassName}`}
                      onClick={() => openEditForm(payment.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          openEditForm(payment.id)
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
                          <span className="text-lg font-bold leading-tight text-foreground">
                            {pDay}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-base font-medium text-foreground">
                            {payment.name}
                          </p>
                          <p className="mt-0.5 text-xs text-foreground-faint">
                            {payment.category}
                          </p>
                        </div>
                        <AnimatedCurrencyValue
                          className={`self-center font-mono text-base ${isCancelled ? 'text-muted-foreground' : 'text-foreground'}`}
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
                                openEditForm(payment.id)
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-danger"
                              onClick={(event) => {
                                event.stopPropagation()
                                cancelPayment(payment.id)
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
                                  reactivatePayment(payment.id)
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
                                  className="text-danger"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    removePayment(payment.id)
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
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs text-foreground-faint">
              No recurring payments added yet.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Click New to register your subscriptions and monthly bills.
            </p>
          </div>
        </div>
      )}

      {editingPayment ? (
        <Dialog
          open={Boolean(editingPaymentId)}
          onOpenChange={(open) => !open && closeEditForm()}
        >
          <DialogContent className="max-h-[92vh] overflow-y-auto p-5 sm:p-6">
            <DialogHeader className="sr-only">
              <DialogTitle>Edit recurring payment</DialogTitle>
              <DialogDescription>
                Adjust amount, schedule, currency, and status in one view.
              </DialogDescription>
            </DialogHeader>
            <RecurringPaymentEditor
              busy={actions.isWorking}
              initialDraft={recurringPaymentToDraft(editingPayment)}
              enabledCurrencies={enabledCurrencies}
              defaultCurrency={defaultCurrency}
              mode="edit"
              onFieldCommit={commitEditField}
            />
          </DialogContent>
        </Dialog>
      ) : null}

      <Dialog
        open={showCreateForm}
        onOpenChange={(open) => !open && closeCreateForm()}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto p-5 sm:p-6">
          <DialogHeader className="sr-only">
            <DialogTitle>New recurring payment</DialogTitle>
            <DialogDescription>
              Create a recurring payment with amount, due day, and start date.
            </DialogDescription>
          </DialogHeader>
          <RecurringPaymentEditor
            busy={actions.isWorking}
            initialDraft={createInitialDraft}
            enabledCurrencies={enabledCurrencies}
            defaultCurrency={defaultCurrency}
            mode="create"
            onCancel={closeCreateForm}
            submitError={createError}
            onSubmit={submitCreatePayment}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
