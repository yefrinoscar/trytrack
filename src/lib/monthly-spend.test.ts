import { describe, expect, test } from 'vite-plus/test'
import { aggregateMonthlyOutflow } from '#/lib/monthly-spend'
import type { OutflowEntry } from '#/lib/monthly-spend'

const reference = new Date(2026, 8, 22) // 22 Sep 2026

const entry = (
  date: string,
  amount: number,
  currency = 'PEN',
): OutflowEntry => ({ date, amount, currency })

describe('aggregateMonthlyOutflow', () => {
  test('totals the month per day and finds the most expensive day', () => {
    const result = aggregateMonthlyOutflow(
      [
        entry('2026-09-14', 100),
        entry('2026-09-14', 50),
        entry('2026-09-02', 20),
        entry('2026-09-21', 30),
      ],
      reference,
    )

    expect(result.currency).toBe('PEN')
    expect(result.total).toBe(200)
    expect(result.peak).toEqual({ day: 14, amount: 150 })
    expect(result.byDay.get(14)).toBe(150)
    expect(result.daysElapsed).toBe(22)
    expect(result.monthLabel).toBe('September')
  })

  test('charts the busiest currency and reports the rest separately', () => {
    const result = aggregateMonthlyOutflow(
      [
        entry('2026-09-10', 40, 'PEN'),
        entry('2026-09-11', 100, 'USD'),
        entry('2026-09-11', 25, 'PEN'),
      ],
      reference,
    )

    // USD wins on total, so it is the drawn line.
    expect(result.currency).toBe('USD')
    expect(result.total).toBe(100)
    expect(result.otherCurrencies).toEqual([{ currency: 'PEN', total: 65 }])
  })

  test('never adds S/ to $', () => {
    const result = aggregateMonthlyOutflow(
      [entry('2026-09-10', 100, 'PEN'), entry('2026-09-10', 100, 'USD')],
      reference,
    )

    // Same day, two currencies: neither total may include the other, so the
    // combined view is two 100s, never a single 200.
    const allTotals = [
      { currency: result.currency ?? '', total: result.total },
      ...result.otherCurrencies,
    ].sort((left, right) => left.currency.localeCompare(right.currency))

    expect(allTotals).toEqual([
      { currency: 'PEN', total: 100 },
      { currency: 'USD', total: 100 },
    ])
  })

  test('ignores other months and zero amounts', () => {
    const result = aggregateMonthlyOutflow(
      [
        entry('2026-09-10', 40),
        entry('2026-08-31', 999),
        entry('2026-10-01', 999),
        entry('2026-09-12', 0),
      ],
      reference,
    )

    expect(result.total).toBe(40)
    expect(result.byDay.size).toBe(1)
  })

  test('returns nothing when there is no movement', () => {
    const result = aggregateMonthlyOutflow([], reference)

    expect(result.currency).toBeNull()
    expect(result.total).toBe(0)
    expect(result.peak).toEqual({ day: 0, amount: 0 })
    expect(result.daysElapsed).toBe(22)
  })

  test('skips malformed dates instead of throwing', () => {
    const result = aggregateMonthlyOutflow(
      [entry('', 10), entry('not-a-date', 10), entry('2026-09-0', 10)],
      reference,
    )

    expect(result.currency).toBeNull()
  })

  test('matches the currency case-insensitively', () => {
    const result = aggregateMonthlyOutflow(
      [entry('2026-09-05', 12, 'pen')],
      reference,
    )

    expect(result.currency).toBe('PEN')
    expect(result.total).toBe(12)
  })
})
