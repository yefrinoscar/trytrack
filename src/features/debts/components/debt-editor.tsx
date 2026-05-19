import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { BadgeDollarSign, CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { parseMoney } from '@/features/finance/shared'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Select } from '@/components/ui/select'
import { DEBT_TYPE_OPTIONS, INSTALLMENT_COUNT_OPTIONS } from '../constants'
import type { DebtDraft, DebtDraftField } from '../types'
import { formatAmountInputValue, getCurrencySymbol } from '../utils/debt-draft'

export function DebtEditor({
  initialDraft,
  enabledCurrencies,
  busy,
  mode,
  submitError,
  onCancel,
  onFieldCommit,
  onSubmit,
}: {
  initialDraft: DebtDraft
  enabledCurrencies: string[]
  busy?: boolean
  mode: 'create' | 'edit'
  submitError?: string | null
  onCancel?: () => void
  onFieldCommit?: (
    field: DebtDraftField,
    value: string,
    nextDraft: DebtDraft,
  ) => void | Promise<void>
  onSubmit?: (draft: DebtDraft) => void | Promise<void>
}) {
  const [draft, setDraft] = useState(initialDraft)
  const draftRef = useRef(initialDraft)

  useEffect(() => {
    draftRef.current = initialDraft
    setDraft(initialDraft)
  }, [initialDraft])

  const updateDraft = useCallback((field: DebtDraftField, value: string) => {
    setDraft((current) => {
      const nextDraft = { ...current, [field]: value }
      draftRef.current = nextDraft
      return nextDraft
    })
  }, [])

  const commitDraftField = useCallback(
    (field: DebtDraftField, value: string) => {
      const nextDraft = { ...draftRef.current, [field]: value }
      draftRef.current = nextDraft
      setDraft(nextDraft)
      void onFieldCommit?.(field, value, nextDraft)
      return nextDraft
    },
    [onFieldCommit],
  )

  const submitDraft = useCallback(
    (nextDraft = draftRef.current) => {
      if (mode !== 'create' || busy) {
        return
      }

      void onSubmit?.(nextDraft)
    },
    [busy, mode, onSubmit],
  )
  const canCreateDebt =
    draft.name.trim().length > 0 && parseMoney(draft.balance) > 0

  return (
    <div className="space-y-4">
      <div>
        <input
          type="text"
          placeholder="Debt title"
          className="w-full bg-transparent text-2xl font-semibold tracking-tight text-foreground outline-none placeholder:text-foreground-faint"
          value={draft.name}
          onChange={(event) => updateDraft('name', event.currentTarget.value)}
          onBlur={(event) =>
            commitDraftField('name', event.currentTarget.value)
          }
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              const nextDraft = commitDraftField(
                'name',
                event.currentTarget.value,
              )
              if (mode === 'create') {
                event.preventDefault()
                submitDraft(nextDraft)
              } else {
                event.currentTarget.blur()
              }
            }
          }}
        />

        <div className="mt-1 flex items-center gap-2">
          <span className="text-xs uppercase tracking-[0.12em] text-foreground-faint">
            Lender
          </span>
          <input
            type="text"
            placeholder="Lender"
            className="min-w-[170px] bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-foreground-faint"
            value={draft.lender}
            onChange={(event) =>
              updateDraft('lender', event.currentTarget.value)
            }
            onBlur={(event) =>
              commitDraftField('lender', event.currentTarget.value)
            }
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                const nextDraft = commitDraftField(
                  'lender',
                  event.currentTarget.value,
                )
                if (mode === 'create') {
                  event.preventDefault()
                  submitDraft(nextDraft)
                } else {
                  event.currentTarget.blur()
                }
              }
            }}
          />
        </div>
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="text-xl font-semibold text-foreground">
          {getCurrencySymbol(draft.currency || 'USD')}
        </span>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          placeholder="0.00"
          className="flex-1 bg-transparent text-xl font-semibold text-foreground outline-none placeholder:text-foreground-faint [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          value={draft.balance}
          onChange={(event) =>
            updateDraft('balance', event.currentTarget.value)
          }
          onBlur={(event) => {
            commitDraftField(
              'balance',
              formatAmountInputValue(event.currentTarget.value),
            )
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              const nextDraft = commitDraftField(
                'balance',
                formatAmountInputValue(event.currentTarget.value),
              )
              if (mode === 'create') {
                event.preventDefault()
                submitDraft(nextDraft)
              } else {
                event.currentTarget.blur()
              }
            }
          }}
        />
        {draft.originalBalance && draft.originalBalance !== draft.balance ? (
          <span className="text-sm text-foreground-faint line-through">
            {getCurrencySymbol(draft.currency || 'USD')}
            {draft.originalBalance}
          </span>
        ) : null}
      </div>

      <div className="space-y-3 pt-3">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-foreground-faint">
          Quick edit
        </p>
        <DebtQuickEditControls
          currency={draft.currency}
          dueDate={draft.dueDate}
          enabledCurrencies={enabledCurrencies}
          payments={draft.payments}
          type={draft.type}
          onCommit={commitDraftField}
        />
      </div>

      {mode === 'create' ? (
        <div className="pt-3">
          {submitError ? (
            <div
              role="alert"
              className="text-destructive mb-2.5 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm"
            >
              {submitError}
            </div>
          ) : null}
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={busy || !canCreateDebt}
              onClick={() => {
                submitDraft()
              }}
            >
              Add debt
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

const chipClassName =
  'inline-flex h-7 w-full min-w-0 items-center rounded-md border border-border bg-card px-2 text-xs transition-colors hover:border-[color-mix(in_srgb,var(--warning)_35%,var(--border))] hover:bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] sm:w-[7.75rem]'
const chipSelectClassName =
  'h-6 w-full min-w-0 border-0 bg-transparent px-0 py-0 pr-5 text-xs font-medium shadow-none [&_svg]:h-3.5 [&_svg]:w-3.5'

const DebtQuickEditControls = memo(function DebtQuickEditControls({
  currency,
  dueDate,
  enabledCurrencies,
  payments,
  type,
  onCommit,
}: {
  currency: string
  dueDate: string
  enabledCurrencies: string[]
  payments: string
  type: string
  onCommit: (field: DebtDraftField, value: string) => void
}) {
  const [showDueDatePicker, setShowDueDatePicker] = useState(false)
  const currencyOptions = Array.from(
    new Set([
      ...enabledCurrencies.map((enabledCurrency) =>
        enabledCurrency.toUpperCase(),
      ),
      currency.toUpperCase(),
    ]),
  )

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className={chipClassName}>
        <Select
          className={chipSelectClassName}
          value={type}
          onChange={(event) => onCommit('type', event.currentTarget.value)}
        >
          {DEBT_TYPE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      </div>

      <div className={chipClassName}>
        <Select
          className={chipSelectClassName}
          value={payments}
          onChange={(event) => onCommit('payments', event.currentTarget.value)}
        >
          {INSTALLMENT_COUNT_OPTIONS.map((installments) => (
            <option key={installments} value={installments}>
              {installments} installments
            </option>
          ))}
        </Select>
      </div>

      <div className={`${chipClassName} gap-2`}>
        <BadgeDollarSign className="h-3 w-3 shrink-0 text-foreground-faint" />
        <Select
          className={`${chipSelectClassName} uppercase`}
          value={currency}
          onChange={(event) => onCommit('currency', event.currentTarget.value)}
        >
          {currencyOptions.map((currencyOption) => (
            <option key={currencyOption} value={currencyOption}>
              {currencyOption}
            </option>
          ))}
        </Select>
      </div>

      <Popover open={showDueDatePicker} onOpenChange={setShowDueDatePicker}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`${chipClassName} gap-2 text-xs font-medium text-foreground`}
          >
            <CalendarIcon className="h-3 w-3 shrink-0 text-foreground-faint" />
            <span className="truncate">
              {dueDate
                ? format(new Date(dueDate + 'T00:00:00'), 'dd MMM')
                : 'Pick date'}
            </span>
          </button>
        </PopoverTrigger>
        {showDueDatePicker ? (
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dueDate ? new Date(dueDate + 'T00:00:00') : undefined}
              onSelect={(date) => {
                if (!date) {
                  return
                }

                onCommit('dueDate', format(date, 'yyyy-MM-dd'))
                setShowDueDatePicker(false)
              }}
              initialFocus
            />
          </PopoverContent>
        ) : null}
      </Popover>
    </div>
  )
})
