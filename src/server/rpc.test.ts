import { afterAll, beforeAll, describe, expect, test } from 'vite-plus/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Verifies the RPC dispatcher (`runRpc`) that backs `useApi().query/mutation` —
 * the path every client call goes through.
 */
let dir: string

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'trytrack-rpc-'))
  const dbPath = join(dir, 'rpc.db')
  process.env.LOCAL_DB_PATH = dbPath
  const migration = execFileSync('ls', ['migrations'])
    .toString()
    .trim()
    .split('\n')[0]
  execFileSync('sqlite3', [dbPath], {
    input: execFileSync('cat', [join('migrations', migration)]),
  })
})

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('rpc dispatcher', () => {
  test('rejects unknown paths', async () => {
    const { runRpc } = await import('#/server/rpc.server')
    await expect(
      runRpc({ path: 'debts.doesNotExist', args: {} }),
    ).rejects.toThrow('Unknown API function')
  })

  test('debt lifecycle runs through the dispatcher', async () => {
    const { runRpc } = await import('#/server/rpc.server')
    const { getDb } = await import('#/server/db/client')
    const { users } = await import('#/server/db/schema')

    const db = await getDb()
    await db.insert(users).values({
      id: 'rpc-user',
      email: 'rpc@test.local',
      name: 'RPC',
      currency: 'USD',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    const debtId = (await runRpc({
      path: 'debts.create',
      args: {
        userId: 'rpc-user',
        name: 'Visa',
        lender: 'Bank',
        type: 'Credit card',
        currency: 'USD',
        balance: 600,
        rate: 20,
        payments: 6,
        dueDate: '2026-06-10',
      },
    })) as string

    const listed = (await runRpc({
      path: 'debts.listByUser',
      args: { userId: 'rpc-user' },
    })) as Array<{ _id: string; name: string }>
    expect(listed.map((d) => d._id)).toContain(debtId)
    expect(listed[0].name).toBe('Visa')

    await runRpc({
      path: 'debts.payNextInstallment',
      args: {
        debtId,
        expectedInstallmentNumber: 1,
        requestId: 'rpc-req-1',
      },
    })

    const overview = (await runRpc({
      path: 'debts.getInstallmentOverview',
      args: { debtIds: [debtId] },
    })) as Array<{ payments: unknown[] }>
    expect(overview[0].payments).toHaveLength(1)

    await runRpc({ path: 'debts.remove', args: { id: debtId } })
    const after = (await runRpc({
      path: 'debts.listByUser',
      args: { userId: 'rpc-user' },
    })) as unknown[]
    expect(after).toHaveLength(0)
  })

  test('expense import + monthly summary run through the dispatcher', async () => {
    const { runRpc } = await import('#/server/rpc.server')

    await runRpc({
      path: 'expenses.create',
      args: {
        userId: 'rpc-user',
        amount: 15,
        currency: 'USD',
        description: 'Snack',
        category: 'Food',
        spentAt: '2026-06-02',
      },
    })

    const summary = (await runRpc({
      path: 'monthlySpend.getMonthlySpendSummary',
      args: { userId: 'rpc-user', month: '2026-06' },
    })) as { actualExpenses: number }
    expect(summary.actualExpenses).toBe(15)
  })
})
