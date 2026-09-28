import { describe, expect, test } from 'vite-plus/test'
import {
  detectRecurringMatches,
  findRecurringMatch,
} from '#/lib/recurring-match'
import type { Expense, RecurringPayment } from '#/lib/finance'

const RATE = 3.38

function payment(overrides: Partial<RecurringPayment> = {}): RecurringPayment {
  return {
    id: 'r1',
    name: 'Luz del Sur',
    category: 'Utilities',
    amount: 160,
    currency: 'PEN',
    dueDay: 21,
    status: 'active',
    startDate: '2026-01-01',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function expense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'e1',
    amount: 160,
    currency: 'PEN',
    category: 'Utilities',
    description: 'Servicio eléctrico',
    spentAt: '2026-09-21',
    createdAt: '2026-09-21T00:00:00.000Z',
    ...overrides,
  }
}

describe('findRecurringMatch', () => {
  test('matches by name even when the amount differs', () => {
    const match = findRecurringMatch(
      payment({ name: 'Netflix' }),
      [expense({ description: 'NETFLIX.COM', amount: 15.99 })],
      '2026-09',
      RATE,
    )

    expect(match?.reason).toBe('name')
    expect(match?.expense.id).toBe('e1')
  })

  test('matches ignores accents and case', () => {
    const match = findRecurringMatch(
      payment({ name: 'Electricidad' }),
      [expense({ description: 'PAGO ELECTRICIDAD SEPTIEMBRE' })],
      '2026-09',
      RATE,
    )

    expect(match?.reason).toBe('name')
  })

  test('falls back to an amount match near the due day', () => {
    const match = findRecurringMatch(
      payment(),
      [expense({ description: 'Servicio eléctrico', spentAt: '2026-09-22' })],
      '2026-09',
      RATE,
    )

    expect(match?.reason).toBe('amount')
  })

  test('rejects an amount match far from the due day', () => {
    const match = findRecurringMatch(
      payment({ dueDay: 21 }),
      [expense({ spentAt: '2026-09-02' })],
      '2026-09',
      RATE,
    )

    expect(match).toBeNull()
  })

  test('matches a converted amount across currencies', () => {
    // 23.60 USD at 3.38 -> 79.77 PEN
    const match = findRecurringMatch(
      payment({ name: 'Seguro', amount: 23.6, currency: 'USD', dueDay: 28 }),
      [expense({ amount: 79.77, currency: 'PEN', spentAt: '2026-09-28' })],
      '2026-09',
      RATE,
    )

    expect(match?.reason).toBe('amount')
  })

  test('ignores expenses from another month', () => {
    const match = findRecurringMatch(
      payment(),
      [expense({ spentAt: '2026-08-21' })],
      '2026-09',
      RATE,
    )

    expect(match).toBeNull()
  })

  test('returns null when nothing resembles the charge', () => {
    const match = findRecurringMatch(
      payment({ amount: 99 }),
      [expense({ amount: 12 })],
      '2026-09',
      RATE,
    )

    expect(match).toBeNull()
  })
})

describe('detectRecurringMatches', () => {
  test('skips inactive payments', () => {
    const matches = detectRecurringMatches(
      [payment({ status: 'cancelled' })],
      [expense()],
      '2026-09',
      RATE,
    )

    expect(matches.size).toBe(0)
  })

  test('returns one match per detected payment', () => {
    const matches = detectRecurringMatches(
      [payment(), payment({ id: 'r2', name: 'Spotify', amount: 10.99 })],
      [expense(), expense({ id: 'e2', description: 'SPOTIFY', amount: 10.99 })],
      '2026-09',
      RATE,
    )

    expect(matches.size).toBe(2)
    expect(matches.get('r1')?.reason).toBe('amount')
    expect(matches.get('r2')?.reason).toBe('name')
  })
})
