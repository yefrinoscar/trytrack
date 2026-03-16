import { Calendar as CalendarIcon, Plus } from 'lucide-react'
import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Select } from '@/components/ui/select'
import type {
  Debt,
  DebtType,
  Goal,
  GoalType,
  Income,
  IncomeFrequency,
  Investment,
  InvestmentType,
  RecurringPayment,
  RecurringPaymentStatus,
} from '@/lib/finance'
import { Field, parseMoney } from '@/features/finance/shared'

export function RecurringPaymentForm({
  onSubmit,
  busy,
  defaultCurrency,
  initialValue = null,
  submitLabel = 'Save recurring payment',
  onCancel,
}: {
  onSubmit: (
    value: Omit<RecurringPayment, 'id' | 'createdAt'>,
  ) => Promise<unknown>
  busy: boolean
  defaultCurrency: string
  initialValue?: RecurringPayment | null
  submitLabel?: string
  onCancel?: () => void
}) {
  const [form, setForm] = useState({
    name: '',
    category: '',
    currency: defaultCurrency,
    amount: '',
    dueDay: '1',
    startDate: undefined as Date | undefined,
    status: 'active' as RecurringPaymentStatus,
  })
  const isLegacyPaused = initialValue?.status === 'paused'

  useEffect(() => {
    if (!initialValue) {
      setForm({
        name: '',
        category: '',
        currency: defaultCurrency,
        amount: '',
        dueDay: '1',
        startDate: undefined,
        status: 'active',
      })

      return
    }

    setForm((current) => ({
      ...current,
      name: initialValue.name,
      category: initialValue.category,
      currency: initialValue.currency,
      amount: String(initialValue.amount),
      dueDay: String(initialValue.dueDay),
      startDate: initialValue.startDate
        ? new Date(initialValue.startDate + 'T00:00:00')
        : undefined,
      status: initialValue.status === 'paused' ? 'active' : initialValue.status,
    }))
  }, [defaultCurrency, initialValue])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!form.name.trim()) {
      return
    }

    await onSubmit({
      name: form.name.trim(),
      category: form.category.trim() || 'Subscription',
      currency: form.currency,
      amount: parseMoney(form.amount),
      dueDay: Math.max(
        1,
        Math.min(31, Math.round(parseMoney(form.dueDay) || 1)),
      ),
      startDate: form.startDate
        ? form.startDate.toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      status: form.status,
    })

    if (!initialValue) {
      setForm({
        name: '',
        category: '',
        currency: defaultCurrency,
        amount: '',
        dueDay: '1',
        startDate: undefined,
        status: 'active',
      })
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <Field htmlFor="recurring-name" label="Name">
        <Input
          id="recurring-name"
          value={form.name}
          onChange={(event) =>
            setForm((current) => ({ ...current, name: event.target.value }))
          }
          placeholder="Netflix subscription"
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field htmlFor="recurring-category" label="Category">
          <Input
            id="recurring-category"
            value={form.category}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                category: event.target.value,
              }))
            }
            placeholder="Subscription, Rent, etc."
          />
        </Field>
        <Field htmlFor="recurring-currency" label="Currency">
          <Select
            id="recurring-currency"
            value={form.currency}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                currency: event.target.value,
              }))
            }
          >
            <option value="USD">USD</option>
            <option value="PEN">PEN</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="MXN">MXN</option>
            <option value="COP">COP</option>
          </Select>
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field htmlFor="recurring-amount" label="Amount">
          <Input
            id="recurring-amount"
            inputMode="decimal"
            type="number"
            step="0.01"
            value={form.amount}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                amount: event.target.value,
              }))
            }
            placeholder="0"
          />
        </Field>
        <Field htmlFor="recurring-day" label="Due day of month">
          <Input
            id="recurring-day"
            type="number"
            min="1"
            max="31"
            value={form.dueDay}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                dueDay: event.target.value,
              }))
            }
            placeholder="1"
          />
        </Field>
      </div>

      <div className="space-y-2">
        <Label>Start date</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-start text-left font-normal"
              data-empty={!form.startDate}
            >
              <CalendarIcon className="h-4 w-4" />
              {form.startDate
                ? format(form.startDate, 'PPP')
                : 'Pick start date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={form.startDate}
              onSelect={(date) =>
                setForm((current) => ({ ...current, startDate: date }))
              }
              captionLayout="dropdown"
              fromYear={2018}
              toYear={2035}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {initialValue ? (
        <Field htmlFor="recurring-status" label="Status">
          <Select
            id="recurring-status"
            value={form.status}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                status: event.target.value as RecurringPaymentStatus,
              }))
            }
          >
            <option value="active">Active</option>
            <option value="cancelled">Cancelled</option>
          </Select>
          {isLegacyPaused ? (
            <p className="mt-2 text-xs leading-5 text-[var(--foreground-soft)]">
              Paused is now treated as a legacy state. Save this payment as
              active or cancelled.
            </p>
          ) : null}
        </Field>
      ) : null}

      <div className="flex gap-2">
        {onCancel ? (
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onCancel}
          >
            Cancel
          </Button>
        ) : null}
        <Button className="flex-1" disabled={busy} type="submit">
          <Plus className="h-4 w-4" />
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

export function DebtForm({
  onSubmit,
  busy,
  submitLabel = 'Add debt',
  initialValue = null,
  onCancel,
  defaultCurrency,
}: {
  onSubmit: (value: Omit<Debt, 'id' | 'createdAt'>) => Promise<unknown>
  busy: boolean
  submitLabel?: string
  initialValue?: Debt | null
  onCancel?: () => void
  defaultCurrency: string
}) {
  const [form, setForm] = useState({
    name: '',
    lender: '',
    type: 'Credit card' as DebtType,
    currency: defaultCurrency,
    balance: '',
    rate: '',
    payments: '1',
    dueDate: '',
  })

  useEffect(() => {
    if (!initialValue) {
      setForm({
        name: '',
        lender: '',
        type: 'Credit card',
        currency: defaultCurrency,
        balance: '',
        rate: '',
        payments: '1',
        dueDate: '',
      })

      return
    }

    setForm({
      name: initialValue.name,
      lender: initialValue.lender,
      type: initialValue.type,
      currency: initialValue.currency,
      balance: String(initialValue.balance),
      rate: String(initialValue.rate),
      payments: String(initialValue.payments ?? 1),
      dueDate: initialValue.dueDate,
    })
  }, [defaultCurrency, initialValue])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!form.name.trim()) {
      return
    }

    await onSubmit({
      name: form.name.trim(),
      lender: form.lender.trim() || 'Personal ledger',
      type: form.type,
      currency: form.currency,
      balance: parseMoney(form.balance),
      rate: parseMoney(form.rate),
      payments: Math.max(1, Math.round(parseMoney(form.payments) || 1)),
      dueDate: form.dueDate || new Date().toISOString().slice(0, 10),
    })

    if (!initialValue) {
      setForm({
        name: '',
        lender: '',
        type: 'Credit card',
        currency: defaultCurrency,
        balance: '',
        rate: '',
        payments: '1',
        dueDate: '',
      })
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <Field htmlFor="debt-name" label="Name">
        <Input
          id="debt-name"
          value={form.name}
          onChange={(event) =>
            setForm((current) => ({ ...current, name: event.target.value }))
          }
          placeholder="Mastercard balance"
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field htmlFor="debt-lender" label="Lender">
          <Input
            id="debt-lender"
            value={form.lender}
            onChange={(event) =>
              setForm((current) => ({ ...current, lender: event.target.value }))
            }
            placeholder="Bank or person"
          />
        </Field>
        <Field htmlFor="debt-type" label="Type">
          <Select
            id="debt-type"
            value={form.type}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                type: event.target.value as DebtType,
              }))
            }
          >
            <option>Credit card</option>
            <option>Loan</option>
            <option>Mortgage</option>
            <option>Other</option>
          </Select>
        </Field>
        <Field htmlFor="debt-currency" label="Currency">
          <Select
            id="debt-currency"
            value={form.currency}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                currency: event.target.value,
              }))
            }
          >
            <option value="USD">USD</option>
            <option value="PEN">PEN</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="MXN">MXN</option>
            <option value="COP">COP</option>
          </Select>
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field htmlFor="debt-balance" label="Balance">
          <Input
            id="debt-balance"
            inputMode="decimal"
            type="number"
            value={form.balance}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                balance: event.target.value,
              }))
            }
            placeholder="0"
          />
        </Field>
        <Field htmlFor="debt-rate" label="APR %">
          <Input
            id="debt-rate"
            inputMode="decimal"
            type="number"
            step="0.1"
            value={form.rate}
            onChange={(event) =>
              setForm((current) => ({ ...current, rate: event.target.value }))
            }
            placeholder="0"
          />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field htmlFor="debt-payments" label="Installments">
          <Input
            id="debt-payments"
            type="number"
            min="1"
            value={form.payments}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                payments: event.target.value,
              }))
            }
            placeholder="1"
          />
        </Field>
        <Field htmlFor="debt-due" label="Due date">
          <Input
            id="debt-due"
            type="date"
            value={form.dueDate}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                dueDate: event.target.value,
              }))
            }
          />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button className="w-full sm:w-auto" disabled={busy} type="submit">
          <Plus className="h-4 w-4" />
          {submitLabel}
        </Button>
        {onCancel ? (
          <Button
            className="w-full sm:w-auto"
            disabled={busy}
            type="button"
            variant="ghost"
            onClick={onCancel}
          >
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  )
}

export function IncomeForm({
  onSubmit,
  busy,
}: {
  onSubmit: (value: Omit<Income, 'id' | 'createdAt'>) => Promise<unknown>
  busy: boolean
}) {
  const [form, setForm] = useState({
    name: '',
    source: '',
    amount: '',
    frequency: 'Monthly' as IncomeFrequency,
    nextDate: '',
  })

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!form.name.trim()) {
      return
    }

    await onSubmit({
      name: form.name.trim(),
      source: form.source.trim() || 'Personal source',
      amount: parseMoney(form.amount),
      frequency: form.frequency,
      nextDate: form.nextDate || new Date().toISOString().slice(0, 10),
    })

    setForm({
      name: '',
      source: '',
      amount: '',
      frequency: 'Monthly',
      nextDate: '',
    })
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <Field htmlFor="income-name" label="Name">
        <Input
          id="income-name"
          value={form.name}
          onChange={(event) =>
            setForm((current) => ({ ...current, name: event.target.value }))
          }
          placeholder="Salary"
        />
      </Field>
      <Field htmlFor="income-source" label="Source">
        <Input
          id="income-source"
          value={form.source}
          onChange={(event) =>
            setForm((current) => ({ ...current, source: event.target.value }))
          }
          placeholder="Company or client"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field htmlFor="income-amount" label="Amount">
          <Input
            id="income-amount"
            type="number"
            value={form.amount}
            onChange={(event) =>
              setForm((current) => ({ ...current, amount: event.target.value }))
            }
            placeholder="0"
          />
        </Field>
        <Field htmlFor="income-frequency" label="Frequency">
          <Select
            id="income-frequency"
            value={form.frequency}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                frequency: event.target.value as IncomeFrequency,
              }))
            }
          >
            <option>Weekly</option>
            <option>Biweekly</option>
            <option>Monthly</option>
            <option>Quarterly</option>
            <option>Yearly</option>
            <option>One-time</option>
          </Select>
        </Field>
      </div>
      <Field htmlFor="income-date" label="Next date">
        <Input
          id="income-date"
          type="date"
          value={form.nextDate}
          onChange={(event) =>
            setForm((current) => ({ ...current, nextDate: event.target.value }))
          }
        />
      </Field>
      <Button className="w-full" disabled={busy} type="submit">
        <Plus className="h-4 w-4" />
        Add income
      </Button>
    </form>
  )
}

export function InvestmentForm({
  onSubmit,
  busy,
}: {
  onSubmit: (value: Omit<Investment, 'id' | 'createdAt'>) => Promise<unknown>
  busy: boolean
}) {
  const [form, setForm] = useState({
    name: '',
    account: '',
    type: 'ETF' as InvestmentType,
    currentValue: '',
    monthlyContribution: '',
    changePct: '',
  })

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!form.name.trim()) {
      return
    }

    await onSubmit({
      name: form.name.trim(),
      account: form.account.trim() || 'Personal account',
      type: form.type,
      currentValue: parseMoney(form.currentValue),
      monthlyContribution: parseMoney(form.monthlyContribution),
      changePct: parseMoney(form.changePct),
    })

    setForm({
      name: '',
      account: '',
      type: 'ETF',
      currentValue: '',
      monthlyContribution: '',
      changePct: '',
    })
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <Field htmlFor="investment-name" label="Name">
        <Input
          id="investment-name"
          value={form.name}
          onChange={(event) =>
            setForm((current) => ({ ...current, name: event.target.value }))
          }
          placeholder="Core ETF basket"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field htmlFor="investment-account" label="Account">
          <Input
            id="investment-account"
            value={form.account}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                account: event.target.value,
              }))
            }
            placeholder="Brokerage"
          />
        </Field>
        <Field htmlFor="investment-type" label="Type">
          <Select
            id="investment-type"
            value={form.type}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                type: event.target.value as InvestmentType,
              }))
            }
          >
            <option>ETF</option>
            <option>Retirement</option>
            <option>Crypto</option>
            <option>Brokerage</option>
            <option>Cash</option>
          </Select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field htmlFor="investment-value" label="Current value">
          <Input
            id="investment-value"
            type="number"
            value={form.currentValue}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                currentValue: event.target.value,
              }))
            }
            placeholder="0"
          />
        </Field>
        <Field htmlFor="investment-monthly" label="Monthly contribution">
          <Input
            id="investment-monthly"
            type="number"
            value={form.monthlyContribution}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                monthlyContribution: event.target.value,
              }))
            }
            placeholder="0"
          />
        </Field>
      </div>
      <Field htmlFor="investment-change" label="Change %">
        <Input
          id="investment-change"
          type="number"
          step="0.1"
          value={form.changePct}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              changePct: event.target.value,
            }))
          }
          placeholder="0"
        />
      </Field>
      <Button className="w-full" disabled={busy} type="submit">
        <Plus className="h-4 w-4" />
        Add investment
      </Button>
    </form>
  )
}

export function GoalForm({
  onSubmit,
  busy,
}: {
  onSubmit: (value: Omit<Goal, 'id' | 'createdAt'>) => Promise<unknown>
  busy: boolean
}) {
  const [form, setForm] = useState({
    name: '',
    type: 'Emergency' as GoalType,
    target: '',
    current: '',
    deadline: '',
  })

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!form.name.trim()) {
      return
    }

    await onSubmit({
      name: form.name.trim(),
      type: form.type,
      target: parseMoney(form.target),
      current: parseMoney(form.current),
      deadline: form.deadline || new Date().toISOString().slice(0, 10),
    })

    setForm({
      name: '',
      type: 'Emergency',
      target: '',
      current: '',
      deadline: '',
    })
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <Field htmlFor="goal-name" label="Name">
        <Input
          id="goal-name"
          value={form.name}
          onChange={(event) =>
            setForm((current) => ({ ...current, name: event.target.value }))
          }
          placeholder="Emergency fund"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field htmlFor="goal-type" label="Type">
          <Select
            id="goal-type"
            value={form.type}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                type: event.target.value as GoalType,
              }))
            }
          >
            <option>Emergency</option>
            <option>Debt payoff</option>
            <option>Investment</option>
            <option>Income</option>
          </Select>
        </Field>
        <Field htmlFor="goal-deadline" label="Deadline">
          <Input
            id="goal-deadline"
            type="date"
            value={form.deadline}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                deadline: event.target.value,
              }))
            }
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field htmlFor="goal-target" label="Target">
          <Input
            id="goal-target"
            type="number"
            value={form.target}
            onChange={(event) =>
              setForm((current) => ({ ...current, target: event.target.value }))
            }
            placeholder="0"
          />
        </Field>
        <Field htmlFor="goal-current" label="Current">
          <Input
            id="goal-current"
            type="number"
            value={form.current}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                current: event.target.value,
              }))
            }
            placeholder="0"
          />
        </Field>
      </div>
      <Button className="w-full" disabled={busy} type="submit">
        <Plus className="h-4 w-4" />
        Add goal
      </Button>
    </form>
  )
}
