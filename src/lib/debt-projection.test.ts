import { describe, expect, test } from 'vite-plus/test'
import { getDebtProjection } from '#/lib/finance'
import type { Debt } from '#/lib/finance'

/**
 * The payoff chart draws whatever this returns. If the balance did not
 * actually fall to zero the curve would look flat and "Debt-free by" would
 * lie, so the shape is worth pinning down.
 */
function makeDebt(overrides: Partial<Debt>): Debt {
  return {
    id: 'd1',
    name: 'Debt',
    lender: 'Bank',
    type: 'Loan',
    currency: 'USD',
    balance: 1200,
    rate: 0,
    payments: 12,
    remainingInstallments: 12,
    dueDate: '2026-01-01',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('getDebtProjection', () => {
  test('falls to zero and stops there', () => {
    const points = getDebtProjection(
      [makeDebt({ balance: 1200, payments: 12, remainingInstallments: 12 })],
      new Date('2026-01-01'),
    )

    expect(points[0]!.balance).toBe(1200)
    expect(points.at(-1)!.balance).toBe(0)
    // 12 installments -> 12 months after "Now".
    expect(points.at(-1)!.monthIndex).toBe(12)
  })

  test('declines monotonically', () => {
    const points = getDebtProjection(
      [
        makeDebt({
          id: 'a',
          balance: 8400,
          payments: 24,
          remainingInstallments: 24,
        }),
        makeDebt({
          id: 'b',
          balance: 1850,
          payments: 12,
          remainingInstallments: 12,
          rate: 26.9,
        }),
      ],
      new Date('2026-01-01'),
    )

    for (let index = 1; index < points.length; index += 1) {
      expect(points[index]!.balance).toBeLessThanOrEqual(
        points[index - 1]!.balance,
      )
    }
  })

  test('labels carry the year so a long projection stays readable', () => {
    const points = getDebtProjection(
      [makeDebt({ balance: 4800, payments: 48, remainingInstallments: 48 })],
      new Date('2026-09-01'),
    )

    expect(points[1]!.label).toMatch(/^[A-Z][a-z]{2} \d{2}$/)
    // Two years in, the label must not read the same as one year in.
    const yearOne = points.find((point) => point.monthIndex === 12)
    const yearTwo = points.find((point) => point.monthIndex === 24)
    expect(yearOne!.label).not.toBe(yearTwo!.label)
  })

  test('returns nothing when there is no active debt', () => {
    expect(getDebtProjection([])).toEqual([])
    expect(
      getDebtProjection([makeDebt({ status: 'closed', balance: 0 })]),
    ).toEqual([])
  })
})
