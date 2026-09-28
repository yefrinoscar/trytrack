import { afterAll, beforeAll, describe, expect, test, vi } from 'vite-plus/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Paid / unpaid tracking for recurring payments, one check per month.
 */
let dir: string

const mockSession = vi.fn()

vi.mock('#/server/auth', () => ({
  getSession: () => mockSession(),
}))

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'trytrack-checks-'))
  process.env.LOCAL_DB_PATH = join(dir, 'checks.db')

  const migrations = execFileSync('ls', ['migrations'])
    .toString()
    .trim()
    .split('\n')
    .filter((name) => name.endsWith('.sql'))
    .sort()
  const sql = migrations
    .map((name) => execFileSync('cat', [join('migrations', name)]).toString())
    .join('\n')
  execFileSync('sqlite3', [process.env.LOCAL_DB_PATH], { input: sql })

  const { getDb } = await import('#/server/db/client')
  const { users } = await import('#/server/db/schema')
  const db = await getDb()
  const now = Date.now()
  await db.insert(users).values({
    id: 'owner',
    email: 'owner@test.local',
    name: 'Owner',
    currency: 'PEN',
    createdAt: now,
    updatedAt: now,
  })

  mockSession.mockResolvedValue({
    user: { id: 'owner', email: 'owner@test.local' },
  })
})

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

async function createPayment(name: string) {
  const api = await import('#/server/api/recurringPayments')
  return await api.create({
    userId: 'owner',
    name,
    category: 'Subscription',
    currency: 'PEN',
    amount: 50,
    dueDay: 10,
    startDate: '2026-01-01',
  })
}

describe('recurring payment checks', () => {
  test('marking paid records a check for that month', async () => {
    const api = await import('#/server/api/recurringPayments')
    const id = await createPayment('Netflix')

    await api.setCheck({ id, month: '2026-09', paid: true })

    const checks = await api.listChecks({ userId: 'owner', month: '2026-09' })
    expect(checks).toHaveLength(1)
    expect(checks[0]!.recurringPaymentId).toBe(id)
    expect(checks[0]!.amount).toBe(50)
  })

  test('marking paid twice does not duplicate', async () => {
    const api = await import('#/server/api/recurringPayments')
    const id = await createPayment('Spotify')

    await api.setCheck({ id, month: '2026-09', paid: true })
    await api.setCheck({ id, month: '2026-09', paid: true })

    const checks = await api.listChecks({ userId: 'owner', month: '2026-09' })
    expect(
      checks.filter((check) => check.recurringPaymentId === id),
    ).toHaveLength(1)
  })

  test('marking unpaid clears it', async () => {
    const api = await import('#/server/api/recurringPayments')
    const id = await createPayment('HBO')

    await api.setCheck({ id, month: '2026-09', paid: true })
    await api.setCheck({ id, month: '2026-09', paid: false })

    const checks = await api.listChecks({ userId: 'owner', month: '2026-09' })
    expect(checks.some((check) => check.recurringPaymentId === id)).toBe(false)
  })

  test('months are tracked separately', async () => {
    const api = await import('#/server/api/recurringPayments')
    const id = await createPayment('Anual')

    await api.setCheck({ id, month: '2026-09', paid: true })

    const october = await api.listChecks({ userId: 'owner', month: '2026-10' })
    expect(october.some((check) => check.recurringPaymentId === id)).toBe(false)

    const september = await api.listChecks({
      userId: 'owner',
      month: '2026-09',
    })
    expect(september.some((check) => check.recurringPaymentId === id)).toBe(
      true,
    )
  })

  test('rejects a payment that belongs to someone else', async () => {
    const api = await import('#/server/api/recurringPayments')
    const { getDb } = await import('#/server/db/client')
    const { recurringPayments } = await import('#/server/db/schema')
    const db = await getDb()
    const now = Date.now()

    await db.insert(recurringPayments).values({
      id: 'someone-else',
      userId: 'other-user',
      name: 'Not mine',
      category: 'Other',
      currency: 'PEN',
      amount: 10,
      cadence: 'monthly',
      dueDay: 1,
      startDate: '2026-01-01',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    })

    await expect(
      api.setCheck({ id: 'someone-else', month: '2026-09', paid: true }),
    ).rejects.toThrow('Recurring payment not found')
  })
})
