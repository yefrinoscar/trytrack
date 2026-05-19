import { Plus } from 'lucide-react'
import type { FormEvent } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Switch } from '@/components/ui/switch'
import type {
  RecurringPaymentDraft,
  RecurringPaymentDraftField,
} from '../types'
import { formatAmountInputValue } from '../utils/recurring-payment-draft'

function normalizeCurrencyCode(value: string) {
  return value.trim().toUpperCase()
}

function isValidCurrencyCode(value: string) {
  return /^[A-Z]{3}$/.test(value)
}

export function RecurringPaymentEditor({
  initialDraft,
  enabledCurrencies,
  defaultCurrency,
  busy,
  mode,
  submitError,
  onCancel,
  onFieldCommit,
  onSubmit,
}: {
  initialDraft: RecurringPaymentDraft
  enabledCurrencies: string[]
  defaultCurrency: string
  busy: boolean
  mode: 'create' | 'edit'
  submitError?: string | null
  onCancel?: () => void
  onFieldCommit?: (
    field: RecurringPaymentDraftField,
    value: string,
    nextDraft: RecurringPaymentDraft,
  ) => void
  onSubmit?: (draft: RecurringPaymentDraft) => void
}) {
  const [draft, setDraft] = useState<RecurringPaymentDraft>(initialDraft)
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const draftRef = useRef(draft)
  draftRef.current = draft

  useEffect(() => {
    setDraft(initialDraft)
  }, [initialDraft])

  const preferredCurrency = (() => {
    const set = new Set(
      enabledCurrencies.map(normalizeCurrencyCode).filter(isValidCurrencyCode),
    )
    const normalizedDefault = normalizeCurrencyCode(defaultCurrency)
    return set.has(normalizedDefault)
      ? normalizedDefault
      : ([...set][0] ?? 'USD')
  })()

  const currencies = (() => {
    const set = new Set(
      enabledCurrencies.map(normalizeCurrencyCode).filter(isValidCurrencyCode),
    )
    const normalizedDraft = normalizeCurrencyCode(draft.currency)
    if (isValidCurrencyCode(normalizedDraft)) set.add(normalizedDraft)
    return [...set]
  })()

  const activeCurrency =
    normalizeCurrencyCode(draft.currency) || preferredCurrency

  const dueDayNumber = Number.parseInt(draft.dueDay, 10) || 1
  const dueDate = new Date(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth(),
    dueDayNumber,
  )

  const { dueDateFormatted, dayOfWeek, statusText, isPaid, isToday } =
    useMemo(() => {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const thisMonthDue = new Date(
        now.getFullYear(),
        now.getMonth(),
        dueDayNumber,
      )
      const nextDue =
        thisMonthDue >= today
          ? thisMonthDue
          : new Date(now.getFullYear(), now.getMonth() + 1, dueDayNumber)

      const diffDays = Math.round(
        (nextDue.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      )
      const past = thisMonthDue < today

      if (past) {
        return {
          dueDateFormatted: format(nextDue, 'MMM d, yyyy'),
          dayOfWeek: format(nextDue, 'EEEE'),
          statusText: 'Paid this month',
          isPaid: true,
          isToday: false,
        }
      }

      if (diffDays === 0) {
        return {
          dueDateFormatted: format(nextDue, 'MMM d, yyyy'),
          dayOfWeek: format(nextDue, 'EEEE'),
          statusText: 'Due today',
          isPaid: false,
          isToday: true,
        }
      }

      return {
        dueDateFormatted: format(nextDue, 'MMM d, yyyy'),
        dayOfWeek: format(nextDue, 'EEEE'),
        statusText: `Due in ${diffDays} day${diffDays !== 1 ? 's' : ''}`,
        isPaid: false,
        isToday: false,
      }
    }, [dueDayNumber])

  const updateDraft = useCallback(
    (field: RecurringPaymentDraftField, value: string) => {
      setDraft((current) => ({ ...current, [field]: value }))
    },
    [],
  )

  const commitDraftField = useCallback(
    (field: RecurringPaymentDraftField, value: string) => {
      if (field === 'amount') {
        const formatted = formatAmountInputValue(value)
        setDraft((current) => ({ ...current, [field]: formatted }))
        onFieldCommit?.(field, formatted, {
          ...draftRef.current,
          [field]: formatted,
        })
        return
      }
      setDraft((current) => ({ ...current, [field]: value }))
      onFieldCommit?.(field, value, {
        ...draftRef.current,
        [field]: value,
      })
    },
    [onFieldCommit],
  )

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!draft.name.trim()) return
    onSubmit?.(draftRef.current)
  }

  const isLegacyPaused = initialDraft.status === 'paused'

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Payment name"
          className="min-w-0 flex-1 bg-transparent text-xl font-semibold tracking-tight text-foreground outline-none placeholder:text-foreground-faint"
          value={draft.name}
          onChange={(event) => updateDraft('name', event.target.value)}
          onBlur={
            mode === 'edit'
              ? (event) => commitDraftField('name', event.target.value)
              : undefined
          }
        />
        {mode === 'edit' && (
          <Switch
            checked={draft.status === 'active'}
            aria-label={draft.status === 'active' ? 'Active' : 'Cancelled'}
            onCheckedChange={(checked) => {
              commitDraftField('status', checked ? 'active' : 'cancelled')
            }}
          />
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-foreground-faint">
          Amount
        </p>
        <div className="flex items-baseline gap-2">
          {currencies.length > 1 && (
            <div className="inline-flex shrink-0 items-center rounded-full border border-border bg-card p-0.5">
              {currencies.map((currency) => (
                <button
                  key={currency}
                  type="button"
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                    currency === activeCurrency
                      ? 'bg-foreground text-background'
                      : 'text-foreground-faint hover:text-foreground'
                  }`}
                  onClick={() => {
                    if (mode === 'edit') commitDraftField('currency', currency)
                    else updateDraft('currency', currency)
                  }}
                >
                  {currency}
                </button>
              ))}
            </div>
          )}
          <span className="text-2xl font-semibold text-foreground-faint">
            {activeCurrency}
          </span>
          <input
            id="recurring-amount"
            inputMode="decimal"
            type="number"
            step="0.01"
            className="flex-1 bg-transparent text-2xl font-semibold text-foreground outline-none placeholder:text-foreground-faint [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            value={draft.amount}
            onChange={(event) => updateDraft('amount', event.target.value)}
            onBlur={
              mode === 'edit'
                ? (event) => commitDraftField('amount', event.target.value)
                : (event) =>
                    updateDraft(
                      'amount',
                      formatAmountInputValue(event.target.value),
                    )
            }
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-foreground-faint">
          Schedule
        </p>
        <Calendar
          mode="single"
          month={calendarMonth}
          onMonthChange={setCalendarMonth}
          selected={dueDate}
          onSelect={(date) => {
            const day = date ? String(date.getDate()) : '1'
            if (mode === 'edit') commitDraftField('dueDay', day)
            else updateDraft('dueDay', day)
          }}
          captionLayout="dropdown"
          fromYear={2020}
          toYear={2035}
          className="rounded-xl border border-border"
        />
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted px-3 py-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
            <span className="font-semibold text-foreground">{dayOfWeek}</span>
            <span className="text-foreground-faint">·</span>
            <span className="text-foreground-faint">{dueDateFormatted}</span>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              isPaid
                ? 'bg-success/15 text-success'
                : isToday
                  ? 'bg-warning/15 text-warning'
                  : 'bg-muted-foreground/10 text-muted-foreground'
            }`}
          >
            {statusText}
          </span>
        </div>
      </div>

      {isLegacyPaused && (
        <p className="rounded-lg border border-border bg-muted px-3 py-2 text-xs leading-5 text-muted-foreground">
          This payment was paused. Save it as active or cancelled.
        </p>
      )}

      {mode === 'create' && (
        <>
          {submitError && (
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs leading-5 text-danger">
              {submitError}
            </p>
          )}
          <div className="flex items-center justify-end gap-2 pt-1">
            {onCancel && (
              <Button type="button" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button disabled={busy || !draft.name.trim()} type="submit">
              <Plus className="h-4 w-4" />
              Add payment
            </Button>
          </div>
        </>
      )}
    </form>
  )
}
