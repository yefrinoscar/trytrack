import { describe, expect, test } from 'vite-plus/test'
import {
  expenseFingerprint,
  recurringPaymentFingerprint,
  toExpenseFromRow,
  toRecurringPaymentFromRow,
} from '#/lib/finance'

/**
 * The dashboard shows expenses from D1 and migrates any rows a browser still
 * has in localStorage, deduped by these helpers. A wrong fingerprint would
 * either duplicate expenses or silently hide real ones.
 */
describe('expense mapping', () => {
  test('maps a D1 row onto the dashboard Expense shape', () => {
    const expense = toExpenseFromRow({
      _id: 'row-1',
      _creationTime: 1_790_000_000_000,
      id: 'row-1',
      userId: 'u1',
      amount: 42.5,
      currency: 'PEN',
      category: 'Food',
      description: 'Almuerzo',
      merchant: 'Cafe',
      spentAt: '2026-09-22',
      createdAt: 1_790_000_000_000,
      updatedAt: 1_790_000_000_000,
    })

    expect(expense.id).toBe('row-1')
    expect(expense.amount).toBe(42.5)
    expect(expense.currency).toBe('PEN')
    expect(expense.merchant).toBe('Cafe')
    expect(expense.createdAt).toBe(new Date(1_790_000_000_000).toISOString())
  })

  test('omits an empty merchant instead of sending null', () => {
    const expense = toExpenseFromRow({
      _id: 'row-2',
      _creationTime: 0,
      id: 'row-2',
      userId: 'u1',
      amount: 1,
      currency: 'USD',
      category: 'Other',
      description: 'x',
      merchant: null,
      spentAt: '2026-09-01',
      createdAt: 0,
      updatedAt: 0,
    })

    expect('merchant' in expense).toBe(false)
  })
})

describe('expense fingerprint', () => {
  test('matches the same expense stored in D1 and in localStorage', () => {
    const row = {
      spentAt: '2026-09-22',
      amount: 42.5,
      currency: 'PEN',
      description: 'Almuerzo',
    }
    // Same values, different id and casing/whitespace.
    const local = {
      spentAt: '2026-09-22',
      amount: 42.5,
      currency: 'pen',
      description: '  almuerzo  ',
    }

    expect(expenseFingerprint(row)).toBe(expenseFingerprint(local))
  })

  test('treats different amounts, dates or currencies as distinct', () => {
    const base = {
      spentAt: '2026-09-22',
      amount: 42.5,
      currency: 'PEN',
      description: 'Almuerzo',
    }

    expect(expenseFingerprint(base)).not.toBe(
      expenseFingerprint({ ...base, amount: 42.51 }),
    )
    expect(expenseFingerprint(base)).not.toBe(
      expenseFingerprint({ ...base, spentAt: '2026-09-23' }),
    )
    expect(expenseFingerprint(base)).not.toBe(
      expenseFingerprint({ ...base, currency: 'USD' }),
    )
    expect(expenseFingerprint(base)).not.toBe(
      expenseFingerprint({ ...base, description: 'Taxi' }),
    )
  })

  test('normalises numeric strings and missing descriptions', () => {
    expect(
      expenseFingerprint({
        spentAt: '2026-09-22',
        amount: '42.50',
        currency: 'PEN',
      }),
    ).toBe(
      expenseFingerprint({
        spentAt: '2026-09-22',
        amount: 42.5,
        currency: 'PEN',
        description: null,
      }),
    )
  })
})

describe('recurring payment mapping', () => {
  test('maps a D1 row onto the dashboard shape', () => {
    const payment = toRecurringPaymentFromRow({
      _id: 'rec-1',
      _creationTime: 1_790_000_000_000,
      id: 'rec-1',
      userId: 'u1',
      name: 'Netflix',
      category: 'Subscription',
      currency: 'PEN',
      amount: 15.99,
      cadence: 'monthly',
      dueDay: 5,
      startDate: '2026-01-01',
      endDate: null,
      status: 'active',
      createdAt: 1_790_000_000_000,
      updatedAt: 1_790_000_000_000,
    })

    expect(payment.id).toBe('rec-1')
    expect(payment.name).toBe('Netflix')
    expect(payment.amount).toBe(15.99)
    expect(payment.dueDay).toBe(5)
    expect(payment.status).toBe('active')
    expect(payment.cadence).toBe('monthly')
    expect('endDate' in payment).toBe(false)
  })

  test('keeps an endDate when present', () => {
    const payment = toRecurringPaymentFromRow({
      _id: 'rec-2',
      _creationTime: 0,
      id: 'rec-2',
      userId: 'u1',
      name: 'Phone',
      category: 'Utilities',
      currency: 'PEN',
      amount: 65,
      cadence: 'monthly',
      dueDay: 20,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      status: 'cancelled',
      createdAt: 0,
      updatedAt: 0,
    })

    expect(payment.endDate).toBe('2026-12-31')
  })

  test('fingerprint matches the same payment in D1 and localStorage', () => {
    const row = {
      name: 'Netflix',
      currency: 'PEN',
      amount: 15.99,
      startDate: '2026-01-01',
    }
    const local = {
      name: '  netflix  ',
      currency: 'pen',
      amount: 15.99,
      startDate: '2026-01-01',
    }

    expect(recurringPaymentFingerprint(row)).toBe(
      recurringPaymentFingerprint(local),
    )
    expect(recurringPaymentFingerprint(row)).not.toBe(
      recurringPaymentFingerprint({ ...row, amount: 16 }),
    )
  })
})
