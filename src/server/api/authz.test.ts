import { afterAll, beforeAll, describe, expect, test, vi } from 'vite-plus/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Authorization tests. The RPC dispatcher is reachable by any signed-in
 * account, so a `userId` argument must never be trusted on its own.
 *
 * `getSession` (which reads the request context) is mocked per test to pretend
 * a specific account is signed in.
 */
let dir: string

const mockSession = vi.fn()

vi.mock('#/server/auth', () => ({
  getSession: () => mockSession(),
}))

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'trytrack-authz-'))
  const dbPath = join(dir, 'authz.db')
  process.env.LOCAL_DB_PATH = dbPath
  const migration = execFileSync('ls', ['migrations'])
    .toString()
    .trim()
    .split('\n')[0]
  execFileSync('sqlite3', [dbPath], {
    input: execFileSync('cat', [join('migrations', migration)]),
  })

  const { getDb } = await import('#/server/db/client')
  const { users } = await import('#/server/db/schema')
  const db = await getDb()
  const now = Date.now()

  await db.insert(users).values([
    {
      id: 'alice',
      email: 'alice@test.local',
      name: 'Alice',
      currency: 'USD',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'bob',
      email: 'bob@test.local',
      name: 'Bob',
      currency: 'USD',
      createdAt: now,
      updatedAt: now,
    },
  ])
})

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

function signInAs(id: string | null) {
  mockSession.mockResolvedValue(
    id ? { user: { id, email: `${id}@test.local` } } : null,
  )
}

describe('authorization', () => {
  test('rejects unauthenticated calls', async () => {
    signInAs(null)
    const { runRpc } = await import('#/server/rpc.server')

    await expect(
      runRpc({ path: 'debts.listByUser', args: { userId: 'alice' } }),
    ).rejects.toThrow('Unauthenticated')
  })

  test('cannot read another account debts', async () => {
    signInAs('bob')
    const { runRpc } = await import('#/server/rpc.server')

    await expect(
      runRpc({ path: 'debts.listByUser', args: { userId: 'alice' } }),
    ).rejects.toThrow('Unauthorized')
  })

  test('cannot create a debt for another account', async () => {
    signInAs('bob')
    const { runRpc } = await import('#/server/rpc.server')

    await expect(
      runRpc({
        path: 'debts.create',
        args: {
          userId: 'alice',
          name: 'Sneaky',
          lender: 'X',
          type: 'Loan',
          currency: 'USD',
          balance: 100,
          rate: 5,
          payments: 2,
          dueDate: '2026-07-01',
        },
      }),
    ).rejects.toThrow('Unauthorized')
  })

  test('owner can read and mutate own debt; other account cannot touch it', async () => {
    signInAs('alice')
    const { runRpc } = await import('#/server/rpc.server')

    const debtId = (await runRpc({
      path: 'debts.create',
      args: {
        userId: 'alice',
        name: 'Alice card',
        lender: 'Bank',
        type: 'Credit card',
        currency: 'USD',
        balance: 500,
        rate: 18,
        payments: 5,
        dueDate: '2026-07-10',
      },
    })) as string

    const mine = (await runRpc({
      path: 'debts.listByUser',
      args: { userId: 'alice' },
    })) as Array<{ _id: string }>
    expect(mine.map((d) => d._id)).toContain(debtId)

    // Bob cannot mutate Alice's debt by id (no userId in these args).
    signInAs('bob')
    await expect(
      runRpc({
        path: 'debts.payNextInstallment',
        args: { debtId, expectedInstallmentNumber: 1, requestId: 'r1' },
      }),
    ).rejects.toThrow('Debt not found')

    await expect(
      runRpc({ path: 'debts.remove', args: { id: debtId } }),
    ).rejects.toThrow('Debt not found')

    // Still intact for the owner.
    signInAs('alice')
    const after = (await runRpc({
      path: 'debts.listByUser',
      args: { userId: 'alice' },
    })) as Array<{ _id: string; balance: number }>
    expect(after).toHaveLength(1)
    expect(after[0].balance).toBe(500)
  })

  test('overview rejects debt ids from another account', async () => {
    signInAs('alice')
    const { runRpc } = await import('#/server/rpc.server')
    const mine = (await runRpc({
      path: 'debts.listByUser',
      args: { userId: 'alice' },
    })) as Array<{ _id: string }>

    signInAs('bob')
    await expect(
      runRpc({
        path: 'debts.getInstallmentOverview',
        args: { debtIds: [mine[0]._id] },
      }),
    ).rejects.toThrow('Debt not found')
  })

  test('expenses are scoped to the owner', async () => {
    signInAs('alice')
    const { runRpc } = await import('#/server/rpc.server')
    const expenseId = (await runRpc({
      path: 'expenses.create',
      args: {
        userId: 'alice',
        amount: 10,
        currency: 'USD',
        description: 'Lunch',
        category: 'Food',
        spentAt: '2026-07-02',
      },
    })) as string

    signInAs('bob')
    await expect(
      runRpc({ path: 'expenses.listByUser', args: { userId: 'alice' } }),
    ).rejects.toThrow('Unauthorized')

    // Bob cannot edit or delete Alice's expense by id.
    await expect(
      runRpc({ path: 'expenses.update', args: { id: expenseId, amount: 1 } }),
    ).rejects.toThrow('Expense not found')
    await expect(
      runRpc({ path: 'expenses.remove', args: { id: expenseId } }),
    ).rejects.toThrow('Expense not found')
  })

  test('monthly summary is scoped to the owner', async () => {
    signInAs('bob')
    const { runRpc } = await import('#/server/rpc.server')
    await expect(
      runRpc({
        path: 'monthlySpend.getMonthlySpendSummary',
        args: { userId: 'alice', month: '2026-07' },
      }),
    ).rejects.toThrow('Unauthorized')
  })

  test('recurring payments are scoped to the owner', async () => {
    signInAs('alice')
    const { runRpc } = await import('#/server/rpc.server')
    const id = (await runRpc({
      path: 'recurringPayments.create',
      args: {
        userId: 'alice',
        name: 'Netflix',
        category: 'Fun',
        currency: 'USD',
        amount: 12,
        dueDay: 5,
        startDate: '2026-01-01',
      },
    })) as string

    signInAs('bob')
    await expect(
      runRpc({
        path: 'recurringPayments.listByUser',
        args: { userId: 'alice' },
      }),
    ).rejects.toThrow('Unauthorized')
    await expect(
      runRpc({ path: 'recurringPayments.remove', args: { id } }),
    ).rejects.toThrow('Recurring payment not found')
  })

  test('webhook-only functions are not reachable over RPC', async () => {
    signInAs('alice')
    const { runRpc } = await import('#/server/rpc.server')

    await expect(
      runRpc({
        path: 'expenses.importFromEmail',
        args: {
          userEmail: 'victim@test.local',
          provider: 'x',
          emailId: 'e1',
          to: [],
        },
      }),
    ).rejects.toThrow('Unknown API function')

    await expect(
      runRpc({ path: 'gmailSync.getState', args: { userEmail: 'a@b.c' } }),
    ).rejects.toThrow('Unknown API function')
  })
})
