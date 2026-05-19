import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { formatCurrency } from '@/lib/finance'
import type { Debt } from '@/lib/finance'
import { INSTALLMENT_TIMELINE_LIMIT } from '../constants'
import {
  getDebtInstallmentState,
  getDebtPaymentTimeline,
} from '../utils/debt-installments'
import { Trash2, Undo2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

function UndoButton({ onUndo }: { onUndo: () => void }) {
  const [armed, setArmed] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => {
    return clearTimer
  }, [clearTimer])

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (armed) {
        clearTimer()
        setArmed(false)
        onUndo()
      } else {
        setArmed(true)
        timerRef.current = setTimeout(() => {
          setArmed(false)
        }, 3000)
      }
    },
    [armed, clearTimer, onUndo],
  )

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={`h-7 w-7 transition-colors ${
        armed
          ? 'text-destructive bg-destructive/10 hover:bg-destructive/20'
          : 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
      }`}
      onClick={handleClick}
      title={armed ? 'Click again to confirm' : 'Undo this payment'}
    >
      {armed ? (
        <Undo2 className="h-3.5 w-3.5" />
      ) : (
        <Trash2 className="h-3.5 w-3.5" />
      )}
    </Button>
  )
}

function CustomInstallmentInput({
  debt,
  busy,
  canPay,
  onSubmit,
}: {
  debt: Debt
  busy?: boolean
  canPay: boolean
  onSubmit: (amount: number, expectedInstallmentNumber: number) => void
}) {
  const [amount, setAmount] = useState('')
  const [showInput, setShowInput] = useState(false)

  const submitAndReset = (value: number, expectedInstallmentNumber: number) => {
    onSubmit(value, expectedInstallmentNumber)
    setAmount('')
    setShowInput(false)
  }

  const remainingAfterPayment = (() => {
    const num = parseFloat(amount)
    if (!num || num <= 0 || debt.balance <= 0) {
      return null
    }
    return Math.max(0, debt.balance - num)
  })()

  const futureInstallmentAmount = (() => {
    if (!remainingAfterPayment || remainingAfterPayment <= 0) {
      return null
    }
    const totalInstallments = debt.payments ?? 1
    const paidCount = debt.installmentPayments?.length ?? 0
    const remainingInstallments = Math.max(1, totalInstallments - paidCount)
    return remainingAfterPayment / remainingInstallments
  })()

  if (!showInput) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy || !canPay}
        onClick={() => setShowInput(true)}
      >
        Custom amount
      </Button>
    )
  }

  return (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
      <label className="flex h-9 min-w-0 flex-1 items-center rounded-md border border-border bg-muted px-3">
        <span className="text-sm text-foreground-faint">$</span>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          placeholder="0.00"
          className="ml-1 min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-foreground-faint [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          value={amount}
          onChange={(e) => setAmount(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && futureInstallmentAmount) {
              submitAndReset(
                parseFloat(amount),
                debt.activePlan?.nextInstallmentNumber ?? 1,
              )
            }
          }}
        />
      </label>
      {futureInstallmentAmount !== null && (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          Next: {formatCurrency(futureInstallmentAmount, debt.currency)}
        </span>
      )}
      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy || !futureInstallmentAmount}
          onClick={() => {
            if (futureInstallmentAmount) {
              submitAndReset(
                parseFloat(amount),
                debt.activePlan?.nextInstallmentNumber ?? 1,
              )
            }
          }}
        >
          Pay custom
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setAmount('')
            setShowInput(false)
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}

function PlanMetric({
  label,
  value,
  muted,
}: {
  label: string
  value: string
  muted?: boolean
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground-faint">
        {label}
      </p>
      <p
        className={`mt-1 font-mono text-sm ${
          muted ? 'text-muted-foreground' : 'text-foreground'
        }`}
      >
        {value}
      </p>
    </div>
  )
}

export function DebtInstallmentPanel({
  debt,
  busy,
  onPayNext,
  onUndoPayment,
  onSetInstallmentAmount,
}: {
  debt: Debt
  busy?: boolean
  onPayNext: (debtId: string, expectedInstallmentNumber: number) => void
  onUndoPayment: (debtId: string, paymentId: string) => void
  onSetInstallmentAmount: (
    debtId: string,
    amount: number,
    expectedInstallmentNumber: number,
  ) => void
}) {
  const {
    activePlan,
    nextInstallmentNumber,
    paidCount,
    remainingInstallments,
    totalDebt,
    totalInstallments,
  } = getDebtInstallmentState(debt)
  const timeline = getDebtPaymentTimeline(debt)
  const visibleTimeline = timeline.slice(-INSTALLMENT_TIMELINE_LIMIT)
  const hiddenTimelineCount = Math.max(
    timeline.length - visibleTimeline.length,
    0,
  )
  const canPayNext =
    debt.status !== 'closed' && nextInstallmentNumber <= totalInstallments
  const planName = activePlan ? `Plan v${activePlan.version}` : 'Installments'
  const nextPaymentAmount =
    activePlan && canPayNext
      ? Math.min(debt.balance, activePlan.installmentAmount)
      : debt.balance
  const paidAmount = Math.max(0, totalDebt - debt.balance)
  const progressValue = totalDebt > 0 ? (paidAmount / totalDebt) * 100 : 0

  return (
    <section className="border-t border-border pt-4">
      <div className="border-b border-border pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="text-lg font-semibold text-foreground">
                {planName}
              </h3>
              <span className="text-sm text-muted-foreground">
                {formatCurrency(paidAmount, debt.currency)} paid so far
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {remainingInstallments} installment
              {remainingInstallments === 1 ? '' : 's'} remaining
            </p>
          </div>

          {debt.status !== 'closed' && debt.balance > 0 ? (
            <div className="flex flex-col gap-2 sm:min-w-[22rem] sm:items-end">
              <div className="flex flex-wrap gap-2 sm:justify-end">
                {canPayNext ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => onPayNext(debt.id, nextInstallmentNumber)}
                  >
                    Pay #{nextInstallmentNumber}
                    <span className="font-mono text-xs opacity-70">
                      {formatCurrency(nextPaymentAmount, debt.currency)}
                    </span>
                  </Button>
                ) : null}
                <CustomInstallmentInput
                  debt={debt}
                  busy={busy}
                  canPay={canPayNext}
                  onSubmit={(amount, expectedInstallmentNumber) =>
                    onSetInstallmentAmount(
                      debt.id,
                      amount,
                      expectedInstallmentNumber,
                    )
                  }
                />
              </div>
            </div>
          ) : (
            <span className="text-sm font-medium text-success">Debt paid</span>
          )}
        </div>

        <div className="mt-5 space-y-2">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Pending balance</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-foreground">
                {formatCurrency(debt.balance, debt.currency)}
              </p>
            </div>
            <p className="text-right font-mono text-sm text-muted-foreground">
              {Math.round(progressValue)}%
            </p>
          </div>
          <Progress value={progressValue} className="h-1.5" />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <PlanMetric
            label="Total debt"
            value={formatCurrency(totalDebt, debt.currency)}
            muted
          />
          <PlanMetric
            label="Paid so far"
            value={formatCurrency(paidAmount, debt.currency)}
          />
          <PlanMetric
            label="Current plan"
            value={`${paidCount}/${totalInstallments}`}
          />
          <PlanMetric
            label="Next due"
            value={canPayNext ? `#${nextInstallmentNumber}` : 'Done'}
            muted={!canPayNext}
          />
        </div>
      </div>

      <div className="mt-6 border-t border-border pt-4 opacity-60 transition-opacity hover:opacity-100">
        {visibleTimeline.length ? (
          <div className="relative border-l border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] pl-4">
            <div className="space-y-4">
              {visibleTimeline.map((payment) => (
                <div key={payment.id} className="relative">
                  <span className="absolute -left-[1.15rem] top-1.5 h-2.5 w-2.5 rounded-full bg-success/60" />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Installment #{payment.installmentNumber}
                      </p>
                      <p className="mt-0.5 text-xs text-foreground-faint">
                        Plan v{payment.planVersion} ·{' '}
                        {format(
                          new Date(`${payment.paidAt}T00:00:00`),
                          'dd MMM yyyy',
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-muted-foreground">
                        {formatCurrency(payment.amountPaid, debt.currency)}
                      </span>
                      <UndoButton
                        onUndo={() => {
                          onUndoPayment(debt.id, payment.id)
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            No paid installments yet. Your first payment will appear here.
          </p>
        )}
        {hiddenTimelineCount ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Showing the latest {visibleTimeline.length} paid installments.
          </p>
        ) : null}
      </div>
    </section>
  )
}
