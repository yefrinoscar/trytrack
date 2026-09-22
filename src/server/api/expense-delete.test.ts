import { afterAll, beforeAll, describe, expect, test, vi } from 'vite-plus/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Deleting an expense must also dismiss the email import that produced it,
 * otherwise the import stays "confirmed" and keeps counting.
 */
let dir: string

const mockSession = vi.fn()

vi.mock('#/server/auth', () => ({
  getSession: () => mockSession(),
}))

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'trytrack-expdel-'))
  process.env.LOCAL_DB_PATH = join(dir, 'expdel.db')

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

async function seedConfirmedImport(expenseId: string, importId: string) {
  const { getDb } = await import('#/server/db/client')
  const { emailExpenseImports, expenses } = await import('#/server/db/schema')
  const db = await getDb()
  const now = Date.now()

  await db.insert(expenses).values({
    id: expenseId,
    userId: 'owner',
    amount: 25,
    currency: 'PEN',
    category: 'Other',
    description: 'Compra en tienda',
    merchant: null,
    spentAt: '2026-09-22',
    createdAt: now,
    updatedAt: now,
  })

  await db.insert(emailExpenseImports).values({
    id: importId,
    userId: 'owner',
    userEmail: 'owner@test.local',
    provider: 'gmail',
    emailId: `gmail:${importId}`,
    to: ['owner@test.local'],
    status: 'confirmed',
    confirmedExpenseId: expenseId,
    createdAt: now,
    updatedAt: now,
  })
}

async function importStatus(importId: string) {
  const { getDb } = await import('#/server/db/client')
  const { emailExpenseImports } = await import('#/server/db/schema')
  const { eq } = await import('drizzle-orm')
  const db = await getDb()
  const [row] = await db
    .select()
    .from(emailExpenseImports)
    .where(eq(emailExpenseImports.id, importId))
    .limit(1)
  return row?.status ?? null
}

describe('deleting an expense dismisses its email import', () => {
  test('remove (UI path) dismisses the linked import', async () => {
    await seedConfirmedImport('exp-ui', 'imp-ui')
    expect(await importStatus('imp-ui')).toBe('confirmed')

    const expensesApi = await import('#/server/api/expenses')
    await expensesApi.remove({ id: 'exp-ui' })

    expect(await importStatus('imp-ui')).toBe('dismissed')
  })

  test('removeByIdForApi (public API) dismisses the linked import', async () => {
    await seedConfirmedImport('exp-api', 'imp-api')
    expect(await importStatus('imp-api')).toBe('confirmed')

    const expensesApi = await import('#/server/api/expenses')
    const deleted = await expensesApi.removeByIdForApi('exp-api')

    expect(deleted).toBe(true)
    expect(await importStatus('imp-api')).toBe('dismissed')
  })

  test('bulk delete dismisses every linked import', async () => {
    await seedConfirmedImport('exp-b1', 'imp-b1')
    await seedConfirmedImport('exp-b2', 'imp-b2')

    const expensesApi = await import('#/server/api/expenses')
    const deleted = await expensesApi.removeMatchingForApi({
      userId: 'owner',
      spentAt: '2026-09-22',
    })

    expect(deleted).toBe(2)
    expect(await importStatus('imp-b1')).toBe('dismissed')
    expect(await importStatus('imp-b2')).toBe('dismissed')
  })

  test('an expense with no linked import still deletes cleanly', async () => {
    const { getDb } = await import('#/server/db/client')
    const { expenses } = await import('#/server/db/schema')
    const db = await getDb()
    const now = Date.now()
    await db.insert(expenses).values({
      id: 'exp-plain',
      userId: 'owner',
      amount: 5,
      currency: 'PEN',
      category: 'Other',
      description: 'Sin correo',
      merchant: null,
      spentAt: '2026-09-23',
      createdAt: now,
      updatedAt: now,
    })

    const expensesApi = await import('#/server/api/expenses')
    const deleted = await expensesApi.removeByIdForApi('exp-plain')
    expect(deleted).toBe(true)
  })
})
