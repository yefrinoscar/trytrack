import { Link } from '@tanstack/react-router'
import { WalletCards } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
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
import type { DashboardData, DebtProjectionPoint } from '@/lib/finance'

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
}: {
  children: (data: DashboardData, actions: FinanceActions) => ReactNode
}) {
  const hydrated = useHydrated()
  const dashboardQuery = useFinanceDashboard(hydrated)
  const actions = useFinanceActions()

  if (!hydrated || dashboardQuery.isPending) {
    return <LoadingState />
  }

  if (dashboardQuery.isError) {
    return (
      <main className="page-wrap px-4 pb-16 pt-10">
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
    <main className="page-wrap px-4 pb-16 pt-10">
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-32 rounded-md bg-[var(--panel)]" />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_300px]">
          <div className="h-[320px] rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)]" />
          <div className="h-[320px] rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)]" />
        </div>
        <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)] p-5">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="h-14 rounded-xl bg-[var(--surface-muted)]"
              />
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
    <section className="relative overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)] px-6 py-6 sm:px-8 sm:py-8">
      <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--border-strong),transparent)]" />
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-[2.35rem]">
            {title}
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-6 text-[var(--foreground-soft)] sm:text-base">
            {description}
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[22rem]">
          {meta.map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-3"
            >
              <p className="eyebrow text-[var(--foreground-faint)]">
                {item.label}
              </p>
              <p className="mt-1.5 text-base font-semibold tracking-tight text-[var(--foreground)] sm:text-base">
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
          <p className="eyebrow text-[var(--foreground-faint)]">{title}</p>
          <div className="grid h-10 w-10 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--foreground)]">
            <Icon className="h-4.5 w-4.5" />
          </div>
        </div>
        <div>
          <p className="text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-[1.85rem]">
            {value}
          </p>
          <p className="mt-1.5 text-base leading-6 text-[var(--foreground-soft)]">
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
        <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">
          {title}
        </h2>
        <p className="mt-1 text-base leading-6 text-[var(--foreground-soft)]">
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
        className="py-12 text-center text-base text-[var(--foreground-soft)]"
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

function buildLinePath(
  points: { x: number; y: number }[],
  closeToBaseline = false,
  baseline = 0,
) {
  if (!points.length) {
    return ''
  }

  const firstPoint = points[0]
  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')

  if (!closeToBaseline) {
    return path
  }

  const lastPoint = points[points.length - 1]

  return `${path} L ${lastPoint.x} ${baseline} L ${firstPoint.x} ${baseline} Z`
}

function getProjectionMarkers(points: DebtProjectionPoint[]) {
  if (!points.length) {
    return []
  }

  const markerIndexes = new Set([
    0,
    Math.floor((points.length - 1) / 2),
    points.length - 1,
  ])

  return [...markerIndexes].map((index) => points[index]).filter(Boolean)
}

export function DebtProjectionChart({
  points,
  currency,
}: {
  points: DebtProjectionPoint[]
  currency: string
}) {
  const [activeIndex, setActiveIndex] = useState(points.length - 1)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setActiveIndex(Math.max(points.length - 1, 0))
  }, [points.length])

  if (!points.length) {
    return (
      <div className="flex h-[80px] items-center justify-center rounded-2xl border border-dashed border-[var(--border)] text-base text-[var(--foreground-soft)]">
        Add a debt to see the payoff curve.
      </div>
    )
  }

  const width = 700
  const height = 80
  const paddingX = 10
  const paddingTop = 12
  const paddingBottom = 26
  const maxBalance = Math.max(...points.map((point) => point.balance), 1)
  const stepX =
    points.length > 1 ? (width - paddingX * 2) / (points.length - 1) : 0
  const chartPoints = points.map((point, index) => {
    const ratio = point.balance / maxBalance

    return {
      ...point,
      x: paddingX + index * stepX,
      y: paddingTop + (1 - ratio) * (height - paddingTop - paddingBottom),
    }
  })
  const areaPath = buildLinePath(chartPoints, true, height - paddingBottom)
  const linePath = buildLinePath(chartPoints)
  const markers = getProjectionMarkers(points)
  const safeActiveIndex = Math.min(activeIndex, chartPoints.length - 1)
  const activePoint =
    chartPoints[safeActiveIndex] ?? chartPoints[chartPoints.length - 1]
  const firstBalance = points[0].balance
  const lastBalance = points[points.length - 1].balance

  function setIndexFromClientX(clientX: number) {
    const overlay = overlayRef.current

    if (!overlay || chartPoints.length < 2) {
      return
    }

    const rect = overlay.getBoundingClientRect()
    const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1)
    const nextIndex = Math.round(ratio * (chartPoints.length - 1))
    setActiveIndex(nextIndex)
  }

  return (
    <div>
      <div className="mb-3">
        <p className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-faint)]">
          {activePoint.monthIndex === 0 ? 'Now' : activePoint.label}
        </p>
        <p className="mt-1 font-mono text-lg text-[var(--foreground)]">
          {formatCurrency(activePoint.balance, currency)}
        </p>
      </div>
      <div className="mb-3 flex items-center justify-between gap-4 text-xs text-[var(--foreground-faint)]">
        <span>{formatCurrency(firstBalance, currency)}</span>
        <span>{formatCurrency(lastBalance, currency)}</span>
      </div>
      <div
        ref={overlayRef}
        className="relative"
        onMouseMove={(event) => setIndexFromClientX(event.clientX)}
        onTouchMove={(event) => setIndexFromClientX(event.touches[0].clientX)}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-[80px] w-full"
          role="img"
        >
          <path
            d={`M ${paddingX} ${height - paddingBottom} H ${width - paddingX}`}
            className="stroke-violet-500"
            strokeOpacity="0.3"
          />
          <path d={areaPath} className="fill-violet-500" fillOpacity="0.15" />
          <path
            d={linePath}
            fill="none"
            className="stroke-violet-500"
            strokeWidth="2.5"
          />
          <path
            d={`M ${activePoint.x} ${paddingTop} V ${height - paddingBottom}`}
            className="stroke-violet-300"
            strokeOpacity="0.4"
            strokeDasharray="4 6"
          />
          <circle
            cx={activePoint.x}
            cy={activePoint.y}
            className="fill-violet-400"
            r="4.5"
          />
        </svg>
        <div
          className="absolute inset-0 grid"
          style={{
            gridTemplateColumns: `repeat(${chartPoints.length}, minmax(0, 1fr))`,
          }}
        >
          {chartPoints.map((point, index) => (
            <button
              key={`${point.monthIndex}-${point.label}`}
              type="button"
              className="h-full w-full cursor-crosshair bg-transparent"
              aria-label={`Projection ${point.label} ${formatCurrency(point.balance, currency)}`}
              onFocus={() => setActiveIndex(index)}
              onMouseEnter={() => setActiveIndex(index)}
            />
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-4 text-xs uppercase tracking-[0.12em] text-[var(--foreground-faint)]">
        {markers.map((point) => (
          <span key={`${point.monthIndex}-${point.label}`}>
            {point.monthIndex === 0 ? 'Now' : point.label}
          </span>
        ))}
      </div>
    </div>
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
        <p className="text-base leading-6 text-[var(--foreground-soft)]">
          {note}
        </p>
        <Separator className="my-4" />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs tracking-[0.12em] uppercase text-[var(--foreground-faint)]">
            {summary}
          </p>
          <Link
            className="inline-flex items-center gap-2 text-base font-medium text-[var(--foreground)] no-underline"
            to={href}
          >
            Open
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
