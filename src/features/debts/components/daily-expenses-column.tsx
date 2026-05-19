import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { FinanceActions } from '@/features/finance/shared'
import { parseMoney } from '@/features/finance/shared'
import { formatCurrency } from '@/lib/finance'
import type { EmailExpenseImport, Expense } from '@/lib/finance'

interface DailyExpensesColumnProps {
  expenses: Expense[]
  emailExpenseImports: EmailExpenseImport[]
  defaultCurrency: string
  actions: FinanceActions
}

function todayKey() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function DailyExpensesColumn({
  expenses,
  emailExpenseImports,
  defaultCurrency,
  actions,
}: DailyExpensesColumnProps) {
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const today = todayKey()
  const todayExpenses = useMemo(
    () =>
      expenses
        .filter((expense) => expense.spentAt === today)
        .slice()
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [expenses, today],
  )
  const todayTotal = todayExpenses.reduce(
    (total, expense) => total + expense.amount,
    0,
  )

  const submitExpense = () => {
    const parsedAmount = parseMoney(amount)

    if (!description.trim()) {
      setError('Expense name is required.')
      return
    }

    if (parsedAmount <= 0) {
      setError('Amount must be greater than 0.')
      return
    }

    setError(null)
    void actions.createItem({
      kind: 'expenses',
      value: {
        amount: parsedAmount,
        currency: defaultCurrency,
        category: 'Daily',
        description: description.trim(),
        spentAt: today,
      },
    })
    setDescription('')
    setAmount('')
  }

  return (
    <div className="w-full rounded-[1.1rem] border border-border bg-card p-3 sm:p-3.5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Today</p>
          <h2 className="mt-1 text-base font-semibold tracking-tight text-foreground">
            Daily expenses
          </h2>
        </div>
        <p className="font-mono text-base font-semibold text-foreground">
          {formatCurrency(todayTotal, defaultCurrency)}
        </p>
      </div>

      <div className="rounded-lg bg-muted p-2.5">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Coffee, lunch..."
            className="min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-foreground-faint"
            value={description}
            onChange={(event) => setDescription(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                submitExpense()
              }
            }}
          />
          <div className="flex w-24 items-baseline gap-1">
            <span className="text-xs text-foreground-faint">
              {defaultCurrency === 'PEN' ? 'S/' : '$'}
            </span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              placeholder="0.00"
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-foreground-faint [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              value={amount}
              onChange={(event) => setAmount(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  submitExpense()
                }
              }}
            />
          </div>
          <Button
            type="button"
            size="icon-sm"
            variant="secondary"
            disabled={actions.isWorking}
            onClick={submitExpense}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {error ? (
          <p className="mt-2 text-xs text-destructive">{error}</p>
        ) : null}
      </div>

      {emailExpenseImports.length ? (
        <div className="mt-3 space-y-2">
          <p className="eyebrow">Email review</p>
          {emailExpenseImports.map((item) => (
            <div key={item.id} className="rounded-lg bg-muted p-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {item.merchant ?? item.subject ?? 'Email expense'}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.spentAt ?? 'No date'} · {item.source ?? 'email'}
                  </p>
                </div>
                <p className="font-mono text-sm font-semibold text-foreground">
                  {typeof item.amount === 'number'
                    ? formatCurrency(
                        item.amount,
                        item.currency ?? defaultCurrency,
                      )
                    : '--'}
                </p>
              </div>
              <div className="mt-2 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={actions.isWorking}
                  onClick={() => {
                    void actions.confirmEmailExpenseImport(item.id)
                  }}
                >
                  Add expense
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={actions.isWorking}
                  onClick={() => {
                    void actions.dismissEmailExpenseImport(item.id)
                  }}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-3 space-y-2">
        {todayExpenses.length ? (
          todayExpenses.map((expense) => (
            <div
              key={expense.id}
              className="flex items-center justify-between gap-3 rounded-lg bg-muted p-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {expense.description}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {expense.category}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-foreground">
                  {formatCurrency(expense.amount, expense.currency)}
                </span>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => {
                    void actions.removeItem({
                      kind: 'expenses',
                      id: expense.id,
                    })
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-lg bg-muted p-4 text-center text-sm text-muted-foreground">
            No expenses logged today.
          </p>
        )}
      </div>
    </div>
  )
}
