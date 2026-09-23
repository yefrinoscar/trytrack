import { describe, expect, test } from 'vite-plus/test'
import { aggregateMonthlySpend } from '#/lib/monthly-spend'

const reference = new Date(2026, 8, 22) // 22 Sep 2026

const expense = (spentAt: string, amount: number, currency = 'PEN') => ({
  spentAt,
  amount,
  currency,
})

describe('aggregateMonthlySpend', () => {
  test('totals the current month and finds the biggest day', () => {
    const result = aggregateMonthlySpend(
      [
        expense('2026-09-14', 100),
        expense('2026-09-14', 50),
        expense('2026-09-02', 20),
        expense('2026-09-21', 30),
      ],
      'PEN',
      reference,
    )

    expect(result.total).toBe(200)
    expect(result.peak).toEqual({ day: 14, amount: 150 })
    expect(result.byDay.get(14)).toBe(150)
    expect(result.daysElapsed).toBe(22)
    expect(result.monthLabel).toBe('September')
  })

  test('ignores other months and other currencies', () => {
    const result = aggregateMonthlySpend(
      [
        expense('2026-09-10', 40),
        expense('2026-08-31', 999),
        expense('2026-10-01', 999),
        expense('2026-09-11', 999, 'USD'),
      ],
      'PEN',
      reference,
    )

    expect(result.total).toBe(40)
    expect(result.peak.day).toBe(10)
    expect(result.byDay.size).toBe(1)
  })

  test('reports no peak when nothing was spent', () => {
    const result = aggregateMonthlySpend([], 'PEN', reference)

    expect(result.total).toBe(0)
    expect(result.peak).toEqual({ day: 0, amount: 0 })
    expect(result.byDay.size).toBe(0)
  })

  test('skips malformed dates instead of throwing', () => {
    const result = aggregateMonthlySpend(
      [expense('', 10), expense('not-a-date', 10), expense('2026-09-0', 10)],
      'PEN',
      reference,
    )

    expect(result.total).toBe(0)
  })

  test('matches the currency case-insensitively', () => {
    const result = aggregateMonthlySpend(
      [expense('2026-09-05', 12, 'pen')],
      'PEN',
      reference,
    )

    expect(result.total).toBe(12)
  })
})
