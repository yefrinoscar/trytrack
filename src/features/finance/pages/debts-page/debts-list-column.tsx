import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import {
  BadgeDollarSign,
  CalendarIcon,
  MoreVertical,
  Pencil,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select } from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AnimatedCurrencyValue, parseMoney } from '@/features/finance/shared'
import type { FinanceActions } from '@/features/finance/shared'
import { formatCurrency } from '@/lib/finance'
import type { Debt } from '@/lib/finance'

const getCurrencySymbol = (currency: string): string => {
  const symbols: Record<string, string> = {
    USD: '$',
    PEN: 'S/',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
  }
  return symbols[currency.toUpperCase()] || currency
}

interface DebtsListColumnProps {
  debts: Debt[]
  defaultCurrency: string
  actions: FinanceActions
}

type DebtDraft = {
  name: string
  lender: string
  type: Debt['type']
  currency: string
  balance: string
  rate: string
  payments: string
  dueDate: string
}

const createEmptyDebtDraft = (currency: string): DebtDraft => ({
  name: '',
  lender: '',
  type: 'Credit card',
  currency,
  balance: '',
  rate: '0',
  payments: '1',
  dueDate: '',
})

const debtToDraft = (debt: Debt): DebtDraft => ({
  name: debt.name,
  lender: debt.lender,
  type: debt.type,
  currency: debt.currency,
  balance: String(debt.balance),
  rate: String(debt.rate),
  payments: String(debt.payments ?? 1),
  dueDate: debt.dueDate,
})

const draftToDebtValue = (
  draft: DebtDraft,
  defaultCurrency: string,
): Omit<Debt, 'id' | 'createdAt'> => ({
  name: draft.name.trim(),
  lender: draft.lender.trim() || 'Personal ledger',
  type: draft.type,
  currency: draft.currency.trim().toUpperCase() || defaultCurrency,
  balance: parseMoney(draft.balance),
  rate: parseMoney(draft.rate),
  payments: Math.max(1, Math.round(parseMoney(draft.payments) || 1)),
  dueDate: draft.dueDate || new Date().toISOString().slice(0, 10),
})

const INSTALLMENT_PREVIEW_LIMIT = 6

const DebtListItem = memo(function DebtListItem({
  debt,
  installmentRows,
  plannedInstallments,
  onOpenEdit,
  onRemove,
}: {
  debt: Debt
  installmentRows: Array<{ key: string; payment: number }>
  plannedInstallments: number
  onOpenEdit: (debtId: string) => void
  onRemove: (debtId: string) => void
}) {
  const actualInstallments = installmentRows.length
  const visibleInstallments = installmentRows.slice(
    0,
    INSTALLMENT_PREVIEW_LIMIT,
  )
  const hiddenInstallments = Math.max(
    actualInstallments - visibleInstallments.length,
    0,
  )

  const dueDateObj = new Date(debt.dueDate + 'T00:00:00')
  const dueMonth = dueDateObj
    .toLocaleString('en', { month: 'short' })
    .toUpperCase()
  const dueDay = dueDateObj.getDate()

  return (
    <div
      className="cursor-pointer rounded-lg bg-[var(--surface-muted)] p-2.5 transition-colors hover:bg-[var(--panel-elevated)]"
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
        <div className="flex min-w-[44px] flex-col items-center justify-center rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--warning)_16%,var(--panel))] px-2 py-1.5">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--warning)]">
            {dueMonth}
          </span>
          <span className="text-lg font-bold leading-tight text-[var(--foreground)]">
            {dueDay}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-medium text-[var(--foreground)]">
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
                onOpenEdit(debt.id)
              }}
            >
              <Pencil className="h-4 w-4" />
              Edit debt
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(event) => {
                event.stopPropagation()
                onRemove(debt.id)
              }}
              className="text-red-600"
            >
              <Trash2 className="h-4 w-4" />
              Delete debt
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mb-2 ml-[56px] space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-[var(--foreground-soft)]">Balance</span>
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
            <>
              {visibleInstallments.map((row, index) => (
                <div
                  key={row.key}
                  className="inline-flex items-center gap-1 rounded-md bg-[color-mix(in_srgb,var(--warning)_20%,transparent)] px-2 py-1 text-xs font-semibold text-[var(--warning)]"
                >
                  {index + 1}/{actualInstallments}{' '}
                  {formatCurrency(row.payment, debt.currency)}
                </div>
              ))}
              {hiddenInstallments ? (
                <div className="inline-flex items-center rounded-md border border-[var(--border)] px-2 py-1 text-xs font-medium text-[var(--foreground-soft)]">
                  +{hiddenInstallments} more
                </div>
              ) : null}
            </>
          ) : (
            <span className="text-xs text-[var(--foreground-soft)]">
              {plannedInstallments} planned installments
            </span>
          )}
        </div>
      </div>
    </div>
  )
})

function DebtEditor({
  initialDraft,
  busy,
  mode,
  onCancel,
  onFieldCommit,
  onSubmit,
}: {
  initialDraft: DebtDraft
  busy?: boolean
  mode: 'create' | 'edit'
  onCancel?: () => void
  onFieldCommit?: (
    field: keyof DebtDraft,
    value: string,
    nextDraft: DebtDraft,
  ) => void | Promise<void>
  onSubmit?: (draft: DebtDraft) => void | Promise<void>
}) {
  const [draft, setDraft] = useState(initialDraft)

  useEffect(() => {
    setDraft(initialDraft)
  }, [initialDraft])

  function updateDraft(field: keyof DebtDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  function commitDraftField(field: keyof DebtDraft, value: string) {
    const nextDraft = { ...draft, [field]: value }
    setDraft(nextDraft)
    void onFieldCommit?.(field, value, nextDraft)
  }

  return (
    <div className="space-y-4">
      <div>
        <input
          type="text"
          placeholder="Debt title"
          className="w-full bg-transparent text-2xl font-semibold tracking-tight text-[var(--foreground)] outline-none placeholder:text-[var(--foreground-faint)]"
          value={draft.name}
          onChange={(e) => updateDraft('name', e.currentTarget.value)}
          onBlur={(e) => commitDraftField('name', e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur()
            }
          }}
        />
        <div className="mt-1 flex items-center gap-2">
          <span className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-faint)]">
            Lender
          </span>
          <input
            type="text"
            placeholder="Lender"
            className="min-w-[170px] bg-transparent text-sm font-medium text-[var(--foreground)] outline-none placeholder:text-[var(--foreground-faint)]"
            value={draft.lender}
            onChange={(e) => updateDraft('lender', e.currentTarget.value)}
            onBlur={(e) => commitDraftField('lender', e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur()
              }
            }}
          />
        </div>
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="text-xl font-semibold text-[var(--foreground)]">
          {getCurrencySymbol(draft.currency || 'USD')}
        </span>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          placeholder="0.00"
          className="flex-1 bg-transparent text-xl font-semibold text-[var(--foreground)] outline-none placeholder:text-[var(--foreground-faint)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          value={draft.balance}
          onChange={(e) => updateDraft('balance', e.currentTarget.value)}
          onBlur={(e) => commitDraftField('balance', e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur()
            }
          }}
        />
      </div>

      <div className="space-y-3 pt-3">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--foreground-faint)]">
          Quick edit
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--panel)] px-1 py-0.5 text-xs transition-colors hover:border-[color-mix(in_srgb,var(--warning)_35%,var(--border))] hover:bg-[color-mix(in_srgb,var(--warning)_10%,transparent)]">
            <Select
              className="h-7 min-w-[138px] border-0 bg-transparent px-2 py-0 pr-7 text-xs font-semibold"
              value={draft.type}
              onChange={(e) => {
                const nextValue = e.currentTarget.value as Debt['type']
                commitDraftField('type', nextValue)
              }}
            >
              <option value="Credit card">Credit card</option>
              <option value="Loan">Loan</option>
              <option value="Mortgage">Mortgage</option>
              <option value="Other">Other</option>
            </Select>
          </div>

          <div className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--panel)] px-1 py-0.5 text-xs transition-colors hover:border-[color-mix(in_srgb,var(--warning)_35%,var(--border))] hover:bg-[color-mix(in_srgb,var(--warning)_10%,transparent)]">
            <Select
              className="h-7 min-w-[148px] border-0 bg-transparent px-2 py-0 pr-7 text-xs font-semibold"
              value={`${Math.max(1, Math.round(parseMoney(draft.payments) || 1))}`}
              onChange={(e) => {
                commitDraftField('payments', e.currentTarget.value)
              }}
            >
              {Array.from({ length: 60 }, (_, index) => {
                const installments = index + 1
                return (
                  <option key={installments} value={installments}>
                    {installments} installments
                  </option>
                )
              })}
            </Select>
          </div>

          <div className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1.5 text-xs transition-colors hover:border-[color-mix(in_srgb,var(--warning)_35%,var(--border))] hover:bg-[color-mix(in_srgb,var(--warning)_10%,transparent)]">
            <BadgeDollarSign className="h-3.5 w-3.5 shrink-0 text-[var(--foreground-faint)]" />
            <input
              type="text"
              placeholder="USD"
              maxLength={3}
              className="w-9 bg-transparent text-xs font-semibold uppercase text-[var(--foreground)] outline-none placeholder:text-[var(--foreground-faint)]"
              value={draft.currency}
              onChange={(e) => updateDraft('currency', e.currentTarget.value)}
              onBlur={(e) =>
                commitDraftField('currency', e.currentTarget.value)
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur()
                }
              }}
            />
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1.5 text-xs font-semibold text-[var(--foreground)] transition-colors hover:border-[color-mix(in_srgb,var(--warning)_35%,var(--border))] hover:bg-[color-mix(in_srgb,var(--warning)_10%,transparent)]"
              >
                <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-[var(--foreground-faint)]" />
                {draft.dueDate
                  ? format(new Date(draft.dueDate + 'T00:00:00'), 'dd MMM')
                  : 'Pick date'}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={
                  draft.dueDate
                    ? new Date(draft.dueDate + 'T00:00:00')
                    : undefined
                }
                onSelect={(date) => {
                  if (!date) {
                    return
                  }

                  const nextDate = format(date, 'yyyy-MM-dd')
                  commitDraftField('dueDate', nextDate)
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {mode === 'create' ? (
        <div className="flex items-center justify-end gap-2 pt-3">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy || !draft.name.trim()}
            onClick={() => {
              void onSubmit?.(draft)
            }}
          >
            Add debt
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export function DebtsListColumn({
  debts,
  defaultCurrency,
  actions,
}: DebtsListColumnProps) {
  const [showCreateDebt, setShowCreateDebt] = useState(false)
  const [editingDebtId, setEditingDebtId] = useState<string | null>(null)
  const [createInitialDraft, setCreateInitialDraft] = useState<DebtDraft>(() =>
    createEmptyDebtDraft(defaultCurrency),
  )

  const debtScope = useMemo(() => {
    const debtsInDefaultCurrency = debts.filter(
      (debt) => debt.currency === defaultCurrency,
    )

    return debtsInDefaultCurrency.length ? debtsInDefaultCurrency : debts
  }, [debts, defaultCurrency])

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

  const openCreateDebtForm = useCallback(() => {
    setCreateInitialDraft(createEmptyDebtDraft(defaultCurrency))
    setShowCreateDebt(true)
  }, [defaultCurrency])

  const openEditDebtForm = useCallback((debtId: string) => {
    setEditingDebtId(debtId)
  }, [])

  const closeCreateDebtForm = useCallback(() => {
    setShowCreateDebt(false)
  }, [])

  const closeEditDebtForm = useCallback(() => {
    setEditingDebtId(null)
  }, [])

  const removeDebt = useCallback(
    (debtId: string) => {
      void actions.removeItem({
        kind: 'debts',
        id: debtId,
      })
    },
    [actions],
  )

  async function commitEditField(
    _field: keyof DebtDraft,
    _value: string,
    nextDraft: DebtDraft,
  ) {
    if (!editingDebt) {
      return
    }

    const normalizedDraft = { ...nextDraft }

    if (!normalizedDraft.name.trim()) {
      normalizedDraft.name = editingDebt.name
    }

    if (!normalizedDraft.lender.trim()) {
      normalizedDraft.lender = editingDebt.lender
    }

    if (!normalizedDraft.currency.trim()) {
      normalizedDraft.currency = editingDebt.currency
    }

    if (!normalizedDraft.balance.trim()) {
      normalizedDraft.balance = String(editingDebt.balance)
    }

    if (!normalizedDraft.payments.trim()) {
      normalizedDraft.payments = String(editingDebt.payments)
    }

    if (!normalizedDraft.dueDate.trim()) {
      normalizedDraft.dueDate = editingDebt.dueDate
    }

    const currentValue = draftToDebtValue(
      debtToDraft(editingDebt),
      defaultCurrency,
    )
    const nextValue = draftToDebtValue(normalizedDraft, defaultCurrency)

    if (JSON.stringify(currentValue) === JSON.stringify(nextValue)) {
      return
    }

    await actions.updateDebt({
      id: editingDebt.id,
      value: { ...editingDebt, ...nextValue },
    })
  }

  async function submitCreateDebt(draft: DebtDraft) {
    const value = draftToDebtValue(draft, defaultCurrency)

    if (!value.name.trim()) {
      return
    }

    await actions.createItem({ kind: 'debts', value })
    closeCreateDebtForm()
  }

  return (
    <div className="inline-block align-top w-[320px] rounded-[1.1rem] border border-[var(--border)] bg-[var(--panel)] p-3 sm:p-3.5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="eyebrow">Debts</p>
          <h2 className="mt-1 text-base font-semibold tracking-tight text-[var(--foreground)]">
            Debt details
          </h2>
        </div>
        <Button
          size="sm"
          variant={showCreateDebt ? 'outline' : 'secondary'}
          onClick={showCreateDebt ? closeCreateDebtForm : openCreateDebtForm}
        >
          {showCreateDebt ? 'Close' : 'New'}
        </Button>
      </div>

      {debtScope.length ? (
        <div className="space-y-2">
          {debtScope.map((debt) => {
            const installmentRows = monthlyPlanRowsByDebtId.get(debt.id) ?? []
            const plannedInstallments = Math.max(
              1,
              Math.round(debt.payments || 1),
            )

            return (
              <DebtListItem
                key={debt.id}
                debt={debt}
                installmentRows={installmentRows}
                plannedInstallments={plannedInstallments}
                onOpenEdit={openEditDebtForm}
                onRemove={removeDebt}
              />
            )
          })}
        </div>
      ) : (
        <div className="rounded-lg border-dashed p-4 text-center text-base text-[var(--foreground-soft)] opacity-50">
          No debts yet. Click New to add one.
        </div>
      )}

      {editingDebt ? (
        <Dialog
          open={Boolean(editingDebtId)}
          onOpenChange={(open) => !open && closeEditDebtForm()}
        >
          <DialogContent className="max-h-[92vh] overflow-y-auto p-5 sm:p-6">
            <DialogHeader className="sr-only">
              <DialogTitle>Edit debt</DialogTitle>
              <DialogDescription>
                Update the debt title, lender, amount, and schedule.
              </DialogDescription>
            </DialogHeader>
            <DebtEditor
              initialDraft={debtToDraft(editingDebt)}
              mode="edit"
              onFieldCommit={commitEditField}
            />
          </DialogContent>
        </Dialog>
      ) : null}

      <Dialog
        open={showCreateDebt}
        onOpenChange={(open) => !open && closeCreateDebtForm()}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto p-5 sm:p-6">
          <DialogHeader className="sr-only">
            <DialogTitle>New debt</DialogTitle>
            <DialogDescription>
              Add a new debt with amount, interest, and payment schedule.
            </DialogDescription>
          </DialogHeader>
          <DebtEditor
            busy={actions.isWorking}
            initialDraft={createInitialDraft}
            mode="create"
            onCancel={closeCreateDebtForm}
            onSubmit={submitCreateDebt}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
