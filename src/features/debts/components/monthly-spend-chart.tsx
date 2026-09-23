import { useMemo } from 'react'
import { formatCurrency } from '@/lib/finance'
import { aggregateMonthlySpend } from '@/lib/monthly-spend'
import type { Expense } from '@/lib/finance'

/**
 * Daily spending for the current month, drawn as a line per currency.
 *
 * Every day from the 1st to today is on the axis, so the shape of the month is
 * visible, and the day with the highest spend is marked and named underneath.
 */
const WIDTH = 700
const HEIGHT = 150
const PAD_X = 8
const PAD_TOP = 16
const PAD_BOTTOM = 24

const PALETTE = [
  { line: 'stroke-violet-500', fill: 'fill-violet-500', dot: 'bg-violet-400' },
  {
    line: 'stroke-emerald-400',
    fill: 'fill-emerald-400',
    dot: 'bg-emerald-400',
  },
  { line: 'stroke-sky-400', fill: 'fill-sky-400', dot: 'bg-sky-400' },
  { line: 'stroke-amber-400', fill: 'fill-amber-400', dot: 'bg-amber-400' },
] as const

function buildPath(points: Array<{ x: number; y: number }>) {
  if (!points.length) {
    return ''
  }

  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')
}

function buildArea(points: Array<{ x: number; y: number }>, baseline: number) {
  if (!points.length) {
    return ''
  }

  const first = points[0]!
  const last = points[points.length - 1]!
  return `${buildPath(points)} L ${last.x} ${baseline} L ${first.x} ${baseline} Z`
}

export function MonthlySpendChart({ expenses }: { expenses: Expense[] }) {
  const { series, daysElapsed, monthLabel } = useMemo(
    () => aggregateMonthlySpend(expenses),
    [expenses],
  )

  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM
  const plotWidth = WIDTH - PAD_X * 2
  const baseline = PAD_TOP + plotHeight
  const maxAmount = Math.max(
    ...series.flatMap((item) => Array.from(item.byDay.values())),
    1,
  )

  const days = Array.from({ length: daysElapsed }, (_, index) => index + 1)
  const stepX = daysElapsed > 1 ? plotWidth / (daysElapsed - 1) : 0
  const xForDay = (day: number) => PAD_X + (day - 1) * stepX
  const yForAmount = (amount: number) =>
    PAD_TOP + (1 - amount / maxAmount) * plotHeight

  const chart = series.map((item, index) => {
    // A missing day is a zero, so the line returns to the axis instead of
    // linking two distant days with a straight line.
    const points = days.map((day) => ({
      x: xForDay(day),
      y: yForAmount(item.byDay.get(day) ?? 0),
    }))

    return {
      ...item,
      colors: PALETTE[index % PALETTE.length]!,
      points,
      linePath: buildPath(points),
      areaPath: index === 0 ? buildArea(points, baseline) : '',
    }
  })

  const headline = series[0] ?? null

  return (
    <div>
      <div className="mb-1">
        <p className="text-xs uppercase tracking-[0.12em] text-foreground-faint">
          Daily spending · {monthLabel}
        </p>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          {chart.length ? (
            chart.map((item) => (
              <p
                key={item.currency}
                className="flex items-baseline gap-2 font-mono text-sm text-foreground"
              >
                <span
                  className={`inline-block h-2 w-2 rounded-full ${item.colors.dot}`}
                />
                {formatCurrency(item.total, item.currency)}
              </p>
            ))
          ) : (
            <p className="font-mono text-sm text-muted-foreground">—</p>
          )}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="w-full h-[150px]"
        role="img"
        aria-label={`Daily spending for ${monthLabel}`}
      >
        {[0.25, 0.5, 0.75].map((ratio) => (
          <path
            key={ratio}
            d={`M ${PAD_X} ${PAD_TOP + ratio * plotHeight} H ${WIDTH - PAD_X}`}
            className="stroke-border"
            strokeDasharray="2 6"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <path
          d={`M ${PAD_X} ${baseline} H ${WIDTH - PAD_X}`}
          className="stroke-border"
          vectorEffect="non-scaling-stroke"
        />

        {chart.map((item) =>
          item.areaPath ? (
            <path
              key={`area-${item.currency}`}
              d={item.areaPath}
              className={item.colors.fill}
              fillOpacity="0.12"
            />
          ) : null,
        )}

        {chart.map((item) => (
          <path
            key={`line-${item.currency}`}
            d={item.linePath}
            fill="none"
            className={item.colors.line}
            strokeWidth="2"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.1em] text-foreground-faint">
        <span>1</span>
        {daysElapsed > 2 ? <span>{Math.round(daysElapsed / 2)}</span> : null}
        <span>{daysElapsed}</span>
      </div>

      <p className="mt-2 text-xs text-foreground-faint">
        {headline && headline.peak.day > 0 ? (
          <>
            Most spent on{' '}
            <span className="font-medium text-foreground">
              {monthLabel} {headline.peak.day}
            </span>
            {' · '}
            <span className="font-mono text-foreground">
              {formatCurrency(headline.peak.amount, headline.currency)}
            </span>
          </>
        ) : (
          <>No expenses recorded this month yet.</>
        )}
      </p>
    </div>
  )
}
