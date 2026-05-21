import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select } from '@/components/ui/select'
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

function timeValue(value: string | undefined) {
  if (!value) {
    return 0
  }

  const timestamp = Date.parse(
    value.includes('T') ? value : `${value}T00:00:00`,
  )

  return Number.isFinite(timestamp) ? timestamp : 0
}

function compareExpensesByMostRecent(left: Expense, right: Expense) {
  return timeValue(right.createdAt) - timeValue(left.createdAt)
}

function compareEmailImportsByMostRecent(
  left: EmailExpenseImport,
  right: EmailExpenseImport,
) {
  const rightTime =
    timeValue(right.occurredAt) ||
    timeValue(right.spentAt) ||
    timeValue(right.createdAt)
  const leftTime =
    timeValue(left.occurredAt) ||
    timeValue(left.spentAt) ||
    timeValue(left.createdAt)

  return rightTime - leftTime
}

const EMAIL_REVIEW_PAGE_SIZE = 12

const EMAIL_EXPENSE_CATEGORIES = [
  'Food',
  'Health',
  'Gifts',
  'Entertainment',
  'Software',
  'Groceries',
  'Transport',
  'Utilities',
  'Education',
  'Home',
  'Shopping',
  'Transfer',
  'Other',
]

const CATEGORY_CHART_COLORS = [
  {
    bar: 'bg-emerald-400',
    dot: 'bg-emerald-300',
    soft: 'bg-emerald-400/12 text-emerald-200',
  },
  { bar: 'bg-sky-400', dot: 'bg-sky-300', soft: 'bg-sky-400/12 text-sky-200' },
  {
    bar: 'bg-amber-400',
    dot: 'bg-amber-300',
    soft: 'bg-amber-400/12 text-amber-200',
  },
  {
    bar: 'bg-rose-400',
    dot: 'bg-rose-300',
    soft: 'bg-rose-400/12 text-rose-200',
  },
  {
    bar: 'bg-violet-400',
    dot: 'bg-violet-300',
    soft: 'bg-violet-400/12 text-violet-200',
  },
  {
    bar: 'bg-cyan-400',
    dot: 'bg-cyan-300',
    soft: 'bg-cyan-400/12 text-cyan-200',
  },
] as const

const emailSourceLabels: Record<
  string,
  {
    brand: string
    label: string
    logo?: string
    tone: string
  }
> = {
  'bbva-card-consumption': {
    brand: 'BBVA',
    label: 'Card',
    logo: '/bbva.svg',
    tone: 'border-[#004481]/20 bg-[#004481]/8 text-[#004481]',
  },
  'bbva-plin-transfer': {
    brand: 'BBVA',
    label: 'Plin',
    logo: '/bbva.svg',
    tone: 'border-[#004481]/20 bg-[#004481]/8 text-[#004481]',
  },
  'bbva-qr-payment': {
    brand: 'BBVA',
    label: 'QR',
    logo: '/bbva.svg',
    tone: 'border-[#004481]/20 bg-[#004481]/8 text-[#004481]',
  },
  'bbva-service-payment': {
    brand: 'BBVA',
    label: 'Service',
    logo: '/bbva.svg',
    tone: 'border-[#004481]/20 bg-[#004481]/8 text-[#004481]',
  },
  'bcp-bank-transfer': {
    brand: 'BCP',
    label: 'Transfer',
    logo: '/bcp.svg',
    tone: 'border-[#f58220]/25 bg-[#f58220]/10 text-[#8a4300]',
  },
  'bcp-card-consumption': {
    brand: 'BCP',
    label: 'Card',
    logo: '/bcp.svg',
    tone: 'border-[#f58220]/25 bg-[#f58220]/10 text-[#8a4300]',
  },
  'yape-payment': {
    brand: 'Yape',
    label: 'Payment',
    logo: '/yape.png',
    tone: 'border-[#742384]/20 bg-[#742384]/8 text-[#742384]',
  },
  'yape-transfer': {
    brand: 'Yape',
    label: 'Transfer',
    logo: '/yape.png',
    tone: 'border-[#742384]/20 bg-[#742384]/8 text-[#742384]',
  },
}

function getEmailSourceMeta(source: string | undefined) {
  if (!source) {
    return {
      brand: 'Email',
      label: 'Import',
      tone: 'border-border bg-card text-muted-foreground',
    }
  }

  return (
    emailSourceLabels[source] ?? {
      brand: 'Email',
      label: source,
      tone: 'border-border bg-card text-muted-foreground',
    }
  )
}

function EmailSourceTag({ source }: { source: string | undefined }) {
  const meta = getEmailSourceMeta(source)

  return (
    <span
      className={`inline-flex h-7 w-7 items-center justify-center rounded-full border ${meta.tone}`}
      title={`${meta.brand} ${meta.label}`}
    >
      {meta.logo ? (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white">
          <img
            alt=""
            aria-hidden="true"
            className={
              meta.brand === 'BBVA'
                ? 'h-3 w-5 object-contain'
                : 'h-6 w-6 object-cover'
            }
            src={meta.logo}
          />
        </span>
      ) : (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/70 text-[0.55rem] font-semibold">
          {meta.brand}
        </span>
      )}
      <span className="sr-only">
        {meta.brand} {meta.label}
      </span>
    </span>
  )
}

function normalizeCategoryText(value: string | undefined) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function suggestEmailExpenseCategory(item: EmailExpenseImport) {
  const merchant = normalizeCategoryText(item.merchant)
  const source = item.source ?? ''

  if (/tripo/.test(merchant)) {
    return 'Software'
  }

  if (/boticas|farmacia|pharma/.test(merchant)) {
    return 'Health'
  }

  if (/floreria|floraza/.test(merchant)) {
    return 'Gifts'
  }

  if (/cinemark|cineplanet/.test(merchant)) {
    return 'Entertainment'
  }

  if (/pvea|plaza vea|tottus|wong|market donna/.test(merchant)) {
    return 'Groceries'
  }

  if (/claro|win internet/.test(merchant)) {
    return 'Utilities'
  }

  if (/britanico/.test(merchant)) {
    return 'Education'
  }

  if (/sodimac/.test(merchant)) {
    return 'Home'
  }

  if (
    /pedidosya|rappi|chicharron|bagu|kfc|puku puku|beso frances|starbucks/.test(
      merchant,
    ) ||
    /^sb\d|^sb -/.test(merchant)
  ) {
    return 'Food'
  }

  if (
    source.includes('plin') ||
    source.includes('yape') ||
    source.includes('bank-transfer') ||
    merchant.startsWith('plin ')
  ) {
    return 'Transfer'
  }

  if (/anomaly|ideas y mas ideas|remign?ton|punto pop/.test(merchant)) {
    return 'Shopping'
  }

  return 'Other'
}

function shortImportId(value: string) {
  return value.length > 18
    ? `${value.slice(0, 10)}...${value.slice(-6)}`
    : value
}

function formatEmailImportDate(value: string | undefined) {
  if (!value) {
    return 'No date'
  }

  const date = new Date(`${value}T00:00:00`)

  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function formatEmailImportDateTime(value: string | undefined) {
  if (!value) {
    return '--'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function isMissingCategory(item: EmailExpenseImport) {
  return !item.category?.trim()
}

function ExpenseCategoryChart({
  emailExpenseImports,
  expenses,
}: {
  emailExpenseImports: EmailExpenseImport[]
  expenses: Expense[]
}) {
  const monthKey = todayKey().slice(0, 7)
  const { currency, rows, total } = useMemo(() => {
    const categories = new Map<
      string,
      {
        category: string
        count: number
        currency: string
        total: number
      }
    >()
    const currencyTotals = new Map<string, number>()

    function addCategory(category: string, currency: string, amount: number) {
      currencyTotals.set(currency, (currencyTotals.get(currency) ?? 0) + amount)

      const key = `${currency}:${category}`
      const current = categories.get(key) ?? {
        category,
        count: 0,
        currency,
        total: 0,
      }

      categories.set(key, {
        ...current,
        count: current.count + 1,
        total: current.total + amount,
      })
    }

    for (const expense of expenses) {
      if (!expense.spentAt.startsWith(monthKey)) {
        continue
      }

      const category = expense.category.trim() || 'Uncategorized'
      addCategory(category, expense.currency, expense.amount)
    }

    const optimisticEmailExpenseIds = new Set(
      expenses
        .map((expense) =>
          expense.id.startsWith('expense-email-')
            ? expense.id.replace('expense-', '')
            : null,
        )
        .filter((id): id is string => Boolean(id)),
    )

    for (const item of emailExpenseImports) {
      if (
        typeof item.amount !== 'number' ||
        !item.currency ||
        !item.spentAt?.startsWith(monthKey) ||
        optimisticEmailExpenseIds.has(item.id)
      ) {
        continue
      }

      addCategory(
        isMissingCategory(item) ? 'Needs category' : item.category!.trim(),
        item.currency,
        item.amount,
      )
    }

    const selectedCurrency =
      [...currencyTotals.entries()].sort(
        (left, right) => right[1] - left[1],
      )[0]?.[0] ?? 'PEN'
    const rankedRows = [...categories.values()]
      .filter((item) => item.currency === selectedCurrency)
      .filter((item) => item.total > 0)
      .sort((left, right) => right.total - left.total)
    const visibleRows = rankedRows.slice(0, 5)
    const remainingRows = rankedRows.slice(5)

    if (remainingRows.length) {
      visibleRows.push({
        category: 'Other categories',
        count: remainingRows.reduce((sum, row) => sum + row.count, 0),
        currency: selectedCurrency,
        total: remainingRows.reduce((sum, row) => sum + row.total, 0),
      })
    }

    return {
      currency: selectedCurrency,
      rows: visibleRows,
      total: rankedRows.reduce((sum, row) => sum + row.total, 0),
    }
  }, [emailExpenseImports, expenses, monthKey])
  const topCategory = rows[0] ?? null

  if (!rows.length) {
    return (
      <div className="mt-3 rounded-lg border border-dashed border-border bg-muted p-3">
        <p className="text-[0.68rem] font-medium uppercase tracking-[0.12em] text-foreground-faint">
          Category chart
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          No categorized spending this month.
        </p>
      </div>
    )
  }

  return (
    <div className="mt-3 rounded-lg bg-muted p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.68rem] font-medium uppercase tracking-[0.12em] text-foreground-faint">
            Category chart
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">
            {topCategory?.category ?? 'No category'}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-base font-semibold text-foreground">
            {formatCurrency(total, currency)}
          </p>
          <p className="text-[0.68rem] text-muted-foreground">This month</p>
        </div>
      </div>

      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-card">
        {rows.map((row, index) => {
          const color =
            row.category === 'Needs category'
              ? CATEGORY_CHART_COLORS[0]
              : CATEGORY_CHART_COLORS[index % CATEGORY_CHART_COLORS.length]

          return (
            <div
              key={row.category}
              className={color.bar}
              style={{ width: `${Math.max((row.total / total) * 100, 3)}%` }}
            />
          )
        })}
      </div>

      <div className="mt-3 space-y-2.5">
        {rows.map((row, index) => (
          <div key={row.category} className="grid gap-1">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="font-mono text-[0.68rem] text-foreground-faint">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    row.category === 'Needs category'
                      ? CATEGORY_CHART_COLORS[0].dot
                      : CATEGORY_CHART_COLORS[
                          index % CATEGORY_CHART_COLORS.length
                        ].dot
                  }`}
                />
                <span className="truncate text-xs text-foreground">
                  {row.category}
                </span>
                <span
                  className={`shrink-0 rounded-full px-1.5 py-0.5 text-[0.62rem] ${
                    row.category === 'Needs category'
                      ? CATEGORY_CHART_COLORS[0].soft
                      : 'bg-card text-muted-foreground'
                  }`}
                >
                  {row.count}
                </span>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono text-xs text-foreground">
                  {formatCurrency(row.total, currency)}
                </p>
                <p className="text-[0.62rem] text-muted-foreground">
                  {Math.round((row.total / total) * 100)}%
                </p>
              </div>
            </div>
            <div className="ml-9 h-1.5 overflow-hidden rounded-full bg-card">
              <div
                className={`h-full rounded-full ${
                  row.category === 'Needs category'
                    ? CATEGORY_CHART_COLORS[0].bar
                    : CATEGORY_CHART_COLORS[
                        index % CATEGORY_CHART_COLORS.length
                      ].bar
                }`}
                style={{
                  width: `${Math.max((row.total / total) * 100, 4)}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string | number | undefined
  mono?: boolean
}) {
  return (
    <div className="grid gap-1 rounded-lg bg-muted p-2.5">
      <dt className="text-[0.68rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </dt>
      <dd
        className={
          mono
            ? 'break-all font-mono text-xs text-foreground'
            : 'break-words text-sm text-foreground'
        }
      >
        {value ?? '--'}
      </dd>
    </div>
  )
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
  const [emailReviewPage, setEmailReviewPage] = useState(0)
  const [emailImportCategory, setEmailImportCategory] = useState('Other')
  const [selectedEmailImport, setSelectedEmailImport] =
    useState<EmailExpenseImport | null>(null)
  const today = todayKey()
  const todayExpenses = useMemo(
    () =>
      expenses
        .filter((expense) => expense.spentAt === today)
        .slice()
        .sort(compareExpensesByMostRecent),
    [expenses, today],
  )
  const sortedEmailExpenseImports = useMemo(
    () => emailExpenseImports.slice().sort(compareEmailImportsByMostRecent),
    [emailExpenseImports],
  )
  const emailReviewPageCount = Math.max(
    1,
    Math.ceil(sortedEmailExpenseImports.length / EMAIL_REVIEW_PAGE_SIZE),
  )
  const currentEmailReviewPage = Math.min(
    emailReviewPage,
    emailReviewPageCount - 1,
  )
  const visibleEmailExpenseImports = sortedEmailExpenseImports.slice(
    currentEmailReviewPage * EMAIL_REVIEW_PAGE_SIZE,
    currentEmailReviewPage * EMAIL_REVIEW_PAGE_SIZE + EMAIL_REVIEW_PAGE_SIZE,
  )

  useEffect(() => {
    setEmailReviewPage((page) => Math.min(page, emailReviewPageCount - 1))
  }, [emailReviewPageCount])

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
      <div className="mb-3">
        <div>
          <p className="eyebrow">Today</p>
          <h2 className="mt-1 text-base font-semibold tracking-tight text-foreground">
            Daily expenses
          </h2>
        </div>
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

      <ExpenseCategoryChart
        emailExpenseImports={emailExpenseImports}
        expenses={expenses}
      />

      {emailExpenseImports.length ? (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">
                {emailExpenseImports.length} payments
              </p>
            </div>
            {emailReviewPageCount > 1 ? (
              <div className="flex items-center rounded-lg bg-muted p-1">
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  disabled={currentEmailReviewPage === 0}
                  onClick={() => {
                    setEmailReviewPage((page) => Math.max(0, page - 1))
                  }}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="min-w-12 px-1 text-center font-mono text-[0.68rem] font-semibold text-foreground">
                  {currentEmailReviewPage + 1}/{emailReviewPageCount}
                </span>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  disabled={currentEmailReviewPage >= emailReviewPageCount - 1}
                  onClick={() => {
                    setEmailReviewPage((page) =>
                      Math.min(emailReviewPageCount - 1, page + 1),
                    )
                  }}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : null}
          </div>

          {visibleEmailExpenseImports.map((item) => (
            <button
              key={item.id}
              type="button"
              className="w-full rounded-lg bg-muted p-2.5 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => {
                setSelectedEmailImport(item)
                setEmailImportCategory(suggestEmailExpenseCategory(item))
              }}
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2">
                <div className="min-w-0 self-start">
                  <div className="flex min-w-0 items-center gap-2">
                    {isMissingCategory(item) ? (
                      <span
                        className="h-2 w-2 shrink-0 rounded-full bg-emerald-400"
                        title="Needs category"
                      />
                    ) : null}
                    <p className="truncate text-sm font-semibold text-foreground">
                      {item.merchant ?? item.subject ?? 'Email expense'}
                    </p>
                  </div>
                </div>
                <p className="min-w-[4.75rem] whitespace-nowrap text-right font-mono text-sm font-semibold text-foreground">
                  {typeof item.amount === 'number'
                    ? formatCurrency(
                        item.amount,
                        item.currency ?? defaultCurrency,
                      )
                    : '--'}
                </p>
                <div className="min-w-0 self-end">
                  <EmailSourceTag source={item.source} />
                </div>
                <p className="self-end whitespace-nowrap text-right text-xs text-muted-foreground">
                  {formatEmailImportDate(item.spentAt)}
                </p>
              </div>
            </button>
          ))}
        </div>
      ) : null}

      <Dialog
        open={Boolean(selectedEmailImport)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedEmailImport(null)
          }
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto p-5 sm:p-6">
          {selectedEmailImport ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {selectedEmailImport.merchant ??
                    selectedEmailImport.subject ??
                    'Email expense'}
                </DialogTitle>
                <DialogDescription>
                  {formatEmailImportDate(selectedEmailImport.spentAt)}
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <EmailSourceTag source={selectedEmailImport.source} />
                <p className="font-mono text-lg font-semibold text-foreground">
                  {typeof selectedEmailImport.amount === 'number'
                    ? formatCurrency(
                        selectedEmailImport.amount,
                        selectedEmailImport.currency ?? defaultCurrency,
                      )
                    : '--'}
                </p>
              </div>

              <dl className="mt-4 grid gap-2 sm:grid-cols-2">
                <DetailRow
                  label="Spent date"
                  value={formatEmailImportDate(selectedEmailImport.spentAt)}
                />
                <DetailRow
                  label="Occurred at"
                  value={formatEmailImportDateTime(
                    selectedEmailImport.occurredAt,
                  )}
                />
                <DetailRow
                  label="Currency"
                  value={selectedEmailImport.currency ?? defaultCurrency}
                />
                <DetailRow
                  label="Subject"
                  value={selectedEmailImport.subject}
                />
                <DetailRow label="From" value={selectedEmailImport.from} mono />
                <DetailRow
                  label="To"
                  value={selectedEmailImport.to.join(', ')}
                  mono
                />
                <DetailRow
                  label="Email ID"
                  value={shortImportId(selectedEmailImport.emailId)}
                  mono
                />
                <DetailRow
                  label="Message ID"
                  value={selectedEmailImport.messageId}
                  mono
                />
                <DetailRow
                  label="Full email ID"
                  value={selectedEmailImport.emailId}
                  mono
                />
              </dl>

              <div className="mt-4 space-y-2">
                <label className="flex items-center justify-between gap-3 rounded-lg bg-muted p-2.5 text-sm font-medium text-foreground">
                  <span>Don't count</span>
                  <input
                    type="checkbox"
                    checked={false}
                    disabled={actions.isWorking}
                    className="h-4 w-4 accent-foreground"
                    onChange={(event) => {
                      if (event.currentTarget.checked) {
                        void actions.dismissEmailExpenseImport(
                          selectedEmailImport.id,
                        )
                        setSelectedEmailImport(null)
                      }
                    }}
                  />
                </label>

                <label
                  className="text-[0.68rem] font-medium uppercase tracking-[0.08em] text-muted-foreground"
                  htmlFor="email-import-category"
                >
                  Category
                </label>
                <Select
                  id="email-import-category"
                  value={emailImportCategory}
                  onChange={(event) => {
                    setEmailImportCategory(event.currentTarget.value)
                  }}
                >
                  {EMAIL_EXPENSE_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </Select>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

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
        ) : emailExpenseImports.length ? null : (
          <p className="rounded-lg bg-muted p-4 text-center text-sm text-muted-foreground">
            No expenses logged today.
          </p>
        )}
      </div>
    </div>
  )
}
