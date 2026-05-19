import { memo } from 'react'
import { MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AnimatedCurrencyValue } from '@/features/finance/shared'
import type { Debt } from '@/lib/finance'
import { getDebtInstallmentState } from '../utils/debt-installments'

export const DebtListItem = memo(function DebtListItem({
  debt,
  onOpenEdit,
  onPayNext,
  onRemove,
}: {
  debt: Debt
  onOpenEdit: (debtId: string) => void
  onPayNext: (debtId: string, expectedInstallmentNumber: number) => void
  onRemove: (debtId: string) => void
}) {
  const { nextInstallmentNumber, paidCount, totalDebt, totalInstallments } =
    getDebtInstallmentState(debt)

  const dueDateObj = new Date(debt.dueDate + 'T00:00:00')
  const dueMonth = dueDateObj
    .toLocaleString('en', { month: 'short' })
    .toUpperCase()
  const dueDay = dueDateObj.getDate()
  const canPayNext =
    debt.status !== 'closed' && nextInstallmentNumber <= totalInstallments
  const isClosed = debt.status === 'closed' || debt.balance <= 0

  return (
    <div
      className={`cursor-pointer rounded-lg bg-muted p-2.5 transition-colors hover:bg-popover ${
        isClosed ? 'opacity-55 hover:opacity-85' : ''
      }`}
      onClick={() => onOpenEdit(debt.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpenEdit(debt.id)
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="mb-2 flex items-start gap-3">
        <div className="flex min-w-[44px] flex-col items-center justify-center rounded-lg border border-border bg-[color-mix(in_srgb,var(--warning)_16%,var(--panel))] px-2 py-1.5">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-warning">
            {dueMonth}
          </span>
          <span className="text-lg font-bold leading-tight text-foreground">
            {dueDay}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-medium text-foreground">
            {debt.name}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-foreground-faint">
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
                onOpenEdit(debt.id)
              }}
            >
              <Pencil className="h-4 w-4" />
              Edit debt
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-red-600"
              onClick={(event) => {
                event.stopPropagation()
                onRemove(debt.id)
              }}
            >
              <Trash2 className="h-4 w-4" />
              Delete debt
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mb-2 ml-[56px] space-y-1.5 text-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <AnimatedCurrencyValue
            className="font-mono text-muted-foreground"
            currency={debt.currency}
            value={totalDebt}
          />
          <span className="text-border-strong">/</span>
          <AnimatedCurrencyValue
            className="font-mono text-foreground"
            currency={debt.currency}
            value={debt.balance}
          />
        </div>
        <div className="flex items-center justify-between gap-2 pt-4 text-xs">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
            <span>
              {paidCount}/{totalInstallments} paid
            </span>
            <span className="text-border-strong">•</span>
            <span>
              {isClosed
                ? 'Paid off'
                : `Next installment #${nextInstallmentNumber}`}
            </span>
          </div>
          {canPayNext ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px]"
              onClick={(event) => {
                event.stopPropagation()
                onPayNext(debt.id, nextInstallmentNumber)
              }}
            >
              Pay #{nextInstallmentNumber}
            </Button>
          ) : isClosed ? (
            <span className="font-medium text-success">Paid</span>
          ) : null}
        </div>
      </div>
    </div>
  )
})
