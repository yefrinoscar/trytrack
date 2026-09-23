import { describe, expect, test } from 'vite-plus/test'
import { aggregateMonthlySpend } from '#/lib/monthly-spend'

const reference = new Date(2026, 8, 22) // 22 Sep 2026

const expense = (spentAt: string, amount: number, currency = 'PEN') => ({
  spentAt,
  amount,
  currency,
})

describe('aggregateMonthlySpend', () => {
  test('totals the month per day and finds the biggest day', () => {
    const { series, daysElapsed, monthLabel } = aggregateMonthlySpend(
      [
        expense('2026-09-14', 100),
        expense('2026-09-14', 50),
        expense('2026-09-02', 20),
        expense('2026-09-21', 30),
      ],
      reference,
    )

    expect(series).toHaveLength(1)
    expect(series[0]!.currency).toBe('PEN')
    expect(series[0]!.total).toBe(200)
    expect(series[0]!.peak).toEqual({ day: 14, amount: 150 })
    expect(series[0]!.byDay.get(14)).toBe(150)
    expect(daysElapsed).toBe(22)
    expect(monthLabel).toBe('September')
  })

  test('keeps currencies apart instead of adding S/ to $', () => {
    const { series } = aggregateMonthlySpend(
      [
        expense('2026-09-10', 40, 'PEN'),
        expense('2026-09-11', 100, 'USD'),
        expense('2026-09-11', 25, 'PEN'),
      ],
      reference,
    )

    expect(series).toHaveLength(2)
    // Sorted by total, largest first.
    expect(series[0]!.currency).toBe('USD')
    expect(series[0]!.total).toBe(100)
    expect(series[1]!.currency).toBe('PEN')
    expect(series[1]!.total).toBe(65)
    expect(series[1]!.peak).toEqual({ day: 10, amount: 40 })
  })

  test('ignores other months', () => {
    const { series } = aggregateMonthlySpend(
      [
        expense('2026-09-10', 40),
        expense('2026-08-31', 999),
        expense('2026-10-01', 999),
      ],
      reference,
    )

    expect(series).toHaveLength(1)
    expect(series[0]!.total).toBe(40)
    expect(series[0]!.byDay.size).toBe(1)
  })

  test('returns no series when nothing was spent', () => {
    const { series, daysElapsed } = aggregateMonthlySpend([], reference)

    expect(series).toEqual([])
    expect(daysElapsed).toBe(22)
  })

  test('skips malformed dates instead of throwing', () => {
    const { series } = aggregateMonthlySpend(
      [expense('', 10), expense('not-a-date', 10), expense('2026-09-0', 10)],
      reference,
    )

    expect(series).toEqual([])
  })

  test('matches the currency case-insensitively', () => {
    const { series } = aggregateMonthlySpend(
      [expense('2026-09-05', 12, 'pen')],
      reference,
    )

    expect(series[0]!.currency).toBe('PEN')
    expect(series[0]!.total).toBe(12)
  })
})
