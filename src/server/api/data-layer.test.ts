import { afterAll, beforeAll, describe, expect, test, vi } from 'vite-plus/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Integration test for the D1/Drizzle data layer. Boots a throwaway SQLite
 * database from the drizzle migration, seeds a user + debt + expense, and
 * exercises the queries and mutations that back the app.
 *
 * Runs sequentially because it points `getDb()` at a temp LOCAL_DB_PATH.
 * `getSession` is mocked so the authorization guards see a signed-in owner.
 */
let dir: string

const mockSession = vi.fn()

vi.mock('#/server/auth', () => ({
  getSession: () => mockSession(),
}))

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'trytrack-db-'))
  const dbPath = join(dir, 'test.db')
  process.env.LOCAL_DB_PATH = dbPath

  const migration = execFileSync('ls', ['drizzle'])
    .toString()
    .trim()
    .split('\n')[0]
  execFileSync('sqlite3', [dbPath], {
    input: execFileSync('cat', [join('drizzle', migration)]),
  })
})

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('local D1 data layer', () => {
  test('creates and reads back debts with installment overview', async () => {
    const { getDb } = await import('#/server/db/client')
    const { users } = await import('#/server/db/schema')
    const debtApi = await import('#/server/api/debts')

    const db = await getDb()
    mockSession.mockResolvedValue({
      user: { id: 'u1', email: 'u1@test.local' },
    })
    await db.insert(users).values({
      id: 'u1',
      email: 'u1@test.local',
      name: 'Test',
      currency: 'USD',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    const debtId = await debtApi.create({
      userId: 'u1',
      name: 'Amex Gold',
      lender: 'Amex',
      type: 'Credit card',
      currency: 'USD',
      balance: 1200,
      rate: 22.8,
      payments: 12,
      dueDate: '2026-05-25',
    })

    const rows = await debtApi.listByUser({ userId: 'u1' })
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Amex Gold')
    expect(rows[0]._id).toBe(debtId)

    const overview = await debtApi.getInstallmentOverview({ debtIds: [debtId] })
    expect(overview).toHaveLength(1)
    expect(overview[0].plans).toHaveLength(1)
    expect(overview[0].plans[0].installmentsTotal).toBe(12)
    expect(overview[0].plans[0].installmentAmount).toBe(100)
  })

  test('payNextInstallment reduces the balance and records a payment', async () => {
    const debtApi = await import('#/server/api/debts')

    const rows = await debtApi.listByUser({ userId: 'u1' })
    const debtId = rows[0]._id as string

    await debtApi.payNextInstallment({
      debtId,
      expectedInstallmentNumber: 1,
      requestId: 'req-1',
    })

    const after = await debtApi.listByUser({ userId: 'u1' })
    expect(after[0].balance).toBe(1100)

    const overview = await debtApi.getInstallmentOverview({ debtIds: [debtId] })
    expect(overview[0].payments).toHaveLength(1)
    expect(overview[0].payments[0].amountPaid).toBe(100)

    // Idempotent on requestId.
    await debtApi.payNextInstallment({
      debtId,
      expectedInstallmentNumber: 1,
      requestId: 'req-1',
    })
    const stillOne = await debtApi.getInstallmentOverview({ debtIds: [debtId] })
    expect(stillOne[0].payments).toHaveLength(1)
  })

  test('monthly spend summary aggregates expenses and planned debt payments', async () => {
    const expenseApi = await import('#/server/api/expenses')
    const monthly = await import('#/server/api/monthlySpend')

    await expenseApi.create({
      userId: 'u1',
      amount: 42.5,
      currency: 'USD',
      description: 'Coffee',
      category: 'Food',
      spentAt: '2026-05-10',
    })

    const summary = await monthly.getMonthlySpendSummary({
      userId: 'u1',
      month: '2026-05',
    })

    expect(summary.actualExpenses).toBe(42.5)
    expect(summary.plannedDebtPayments).toBe(100)
    expect(summary.totalMonthlySpend).toBe(142.5)
  })
})
