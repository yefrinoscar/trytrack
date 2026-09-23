import { Link } from '@tanstack/react-router'
import type { WalletCards } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { TableCell, TableRow } from '@/components/ui/table'
import {
  formatCompactCurrency,
  formatCurrency,
  useFinanceActions,
  useFinanceDashboard,
} from '@/lib/finance'
import type { DashboardData } from '@/lib/finance'

export type FinanceActions = ReturnType<typeof useFinanceActions>

function useHydrated() {
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  return hydrated
}

export function FinancePageState({
  children,
  loading,
}: {
  children: (data: DashboardData, actions: FinanceActions) => ReactNode
  loading?: ReactNode
}) {
  const hydrated = useHydrated()
  const dashboardQuery = useFinanceDashboard(hydrated)
  const actions = useFinanceActions()

  if (!hydrated || dashboardQuery.isPending) {
    return <>{loading ?? <LoadingState />}</>
  }

  if (dashboardQuery.isError) {
    return (
      <main className="page-wrap px-4 pb-16">
        <Card>
          <CardHeader>
            <CardTitle>Could not load your desk</CardTitle>
            <CardDescription>
              Refresh the page to try again. Your browser storage might be
              blocked.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    )
  }

  return <>{children(dashboardQuery.data, actions)}</>
}

function LoadingState() {
  return (
    <main className="page-wrap px-4 pb-16">
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-32 rounded-md bg-card" />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_300px]">
          <div className="h-[320px] rounded-[1.5rem] border border-border bg-card" />
          <div className="h-[320px] rounded-[1.5rem] border border-border bg-card" />
        </div>
        <div className="rounded-[1.5rem] border border-border bg-card p-5">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-14 rounded-xl bg-muted" />
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}

export function PageIntro({
  eyebrow,
  title,
  description,
  meta,
}: {
  eyebrow: string
  title: string
  description: string
  meta: { label: string; value: string }[]
}) {
  return (
    <section className="relative overflow-hidden rounded-[1.5rem] border border-border bg-card px-6 py-6 sm:px-8 sm:py-8">
      <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--border-strong),transparent)]" />
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-[2.35rem]">
            {title}
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-6 text-muted-foreground sm:text-base">
            {description}
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[22rem]">
          {meta.map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-border bg-muted px-3 py-3"
            >
              <p className="eyebrow text-foreground-faint">{item.label}</p>
              <p className="mt-1.5 text-base font-semibold tracking-tight text-foreground sm:text-base">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function MetricCard({
  title,
  value,
  note,
  icon: Icon,
}: {
  title: string
  value: string
  note: string
  icon: typeof WalletCards
}) {
  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow text-foreground-faint">{title}</p>
          <div className="grid h-10 w-10 place-items-center rounded-2xl border border-border bg-muted text-foreground">
            <Icon className="h-4.5 w-4.5" />
          </div>
        </div>
        <div>
          <p className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.85rem]">
            {value}
          </p>
          <p className="mt-1.5 text-base leading-6 text-muted-foreground">
            {note}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

export function SectionTitle({
  title,
  description,
  badge,
}: {
  title: string
  description: string
  badge?: string
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="mt-1 text-base leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
      {badge ? <Badge>{badge}</Badge> : null}
    </div>
  )
}

export function EmptyRow({
  message,
  colSpan,
}: {
  message: string
  colSpan: number
}) {
  return (
    <TableRow>
      <TableCell
        colSpan={colSpan}
        className="py-12 text-center text-base text-muted-foreground"
      >
        {message}
      </TableCell>
    </TableRow>
  )
}

export function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}

export function currencyVariant(
  kind: 'Debt' | 'Income' | 'Investment' | 'Goal',
) {
  switch (kind) {
    case 'Income':
    case 'Investment':
      return 'success'
    case 'Goal':
      return 'default'
    case 'Debt':
      return 'warning'
  }
}

export function parseMoney(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function AnimatedCurrencyValue({
  value,
  currency,
  className,
  compact = false,
  duration = 900,
}: {
  value: number
  currency: string
  className?: string
  compact?: boolean
  duration?: number
}) {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    const targetValue = Number.isFinite(value) ? value : 0

    if (typeof window !== 'undefined') {
      const prefersReducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches

      if (prefersReducedMotion) {
        setDisplayValue(targetValue)
        return
      }
    }

    let frameId = 0
    let startTime: number | null = null

    const animate = (timestamp: number) => {
      if (startTime === null) {
        startTime = timestamp
      }

      const progress = Math.min((timestamp - startTime) / duration, 1)
      const easedProgress = 1 - (1 - progress) ** 3
      const nextValue = targetValue * easedProgress

      setDisplayValue(nextValue)

      if (progress < 1) {
        frameId = window.requestAnimationFrame(animate)
      }
    }

    frameId = window.requestAnimationFrame(animate)

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [duration, value])

  const formattedValue = compact
    ? formatCompactCurrency(displayValue, currency)
    : formatCurrency(displayValue, currency)

  return <span className={className}>{formattedValue}</span>
}

export function sortByDateAscending<T>(
  items: T[],
  getter: (item: T) => string,
) {
  return [...items].sort(
    (left, right) => +new Date(getter(left)) - +new Date(getter(right)),
  )
}

export function QuickLinkCard({
  title,
  href,
  value,
  note,
  summary,
}: {
  title: string
  href: string
  value: string
  note: string
  summary: string
}) {
  return (
    <Card className="h-full">
      <CardHeader className="border-b-0 pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-base leading-6 text-muted-foreground">{note}</p>
        <Separator className="my-4" />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs tracking-[0.12em] uppercase text-foreground-faint">
            {summary}
          </p>
          <Link
            className="inline-flex items-center gap-2 text-base font-medium text-foreground no-underline"
            to={href}
          >
            Open
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
