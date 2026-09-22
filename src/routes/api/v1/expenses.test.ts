import { afterAll, beforeAll, describe, expect, test } from 'vite-plus/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Public expense API (`POST /api/v1/expenses`). Authenticates with a shared
 * `EXPENSES_API_KEY` instead of a browser session.
 */
let dir: string
let handle: (request: Request) => Promise<Response>

const KEY = 'test-api-key-1234567890'

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'trytrack-apiv1-'))
  process.env.LOCAL_DB_PATH = join(dir, 'api.db')
  process.env.EXPENSES_API_KEY = KEY

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
    id: 'api-user',
    email: 'api@test.local',
    name: 'API',
    currency: 'USD',
    createdAt: now,
    updatedAt: now,
  })

  handle = (await import('#/routes/api/v1/expenses')).handleCreateExpense
})

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
  delete process.env.EXPENSES_API_KEY
})

function post(body: unknown, key = KEY) {
  return handle(
    new Request('https://trytrack.test/api/v1/expenses', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(key ? { authorization: `Bearer ${key}` } : {}),
      },
      body: JSON.stringify(body),
    }),
  )
}

const valid = {
  email: 'api@test.local',
  amount: 42.5,
  currency: 'USD',
  description: 'Lunch',
  category: 'Food',
  spentAt: '2026-09-22',
}

describe('public expense API', () => {
  test('rejects a missing or wrong key', async () => {
    expect((await post(valid, '')).status).toBe(401)
    expect((await post(valid, 'wrong-key-000000000000')).status).toBe(401)
  })

  test('rejects non-POST methods', async () => {
    const res = await handle(
      new Request('https://trytrack.test/api/v1/expenses', { method: 'GET' }),
    )
    expect(res.status).toBe(405)
  })

  test('validates required fields', async () => {
    const res = await post({ email: 'api@test.local' })
    expect(res.status).toBe(422)
    const body = (await res.json()) as {
      fields: Record<string, string>
    }
    expect(Object.keys(body.fields).sort()).toEqual(
      ['amount', 'currency', 'description', 'spentAt'].sort(),
    )
  })

  test('rejects a bad currency and date format', async () => {
    const res = await post({
      ...valid,
      currency: 'dollars',
      spentAt: '22/09/2026',
    })
    expect(res.status).toBe(422)
    const body = (await res.json()) as { fields: Record<string, string> }
    expect(body.fields.currency).toBeDefined()
    expect(body.fields.spentAt).toBeDefined()
  })

  test('rejects a negative amount', async () => {
    const res = await post({ ...valid, amount: -5 })
    expect(res.status).toBe(422)
  })

  test('returns 404 for an unknown account', async () => {
    const res = await post({ ...valid, email: 'nobody@test.local' })
    expect(res.status).toBe(404)
  })

  test('creates the expense and it is readable for the owner', async () => {
    const res = await post(valid)
    expect(res.status).toBe(201)
    const body = (await res.json()) as { ok: boolean; id: string }
    expect(body.ok).toBe(true)
    expect(body.id).toBeTruthy()

    const { getDb } = await import('#/server/db/client')
    const { expenses } = await import('#/server/db/schema')
    const db = await getDb()
    const rows = await db.select().from(expenses)
    const created = rows.find((row) => row.id === body.id)

    expect(created?.userId).toBe('api-user')
    expect(created?.amount).toBe(42.5)
    expect(created?.currency).toBe('USD')
    expect(created?.category).toBe('Food')
    expect(created?.spentAt).toBe('2026-09-22')
  })

  test('defaults the category and normalises currency case', async () => {
    const res = await post({
      ...valid,
      currency: 'pen',
      category: undefined,
      merchant: 'Cafe',
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { id: string }

    const { getDb } = await import('#/server/db/client')
    const { expenses } = await import('#/server/db/schema')
    const db = await getDb()
    const rows = await db.select().from(expenses)
    const created = rows.find((row) => row.id === body.id)

    expect(created?.currency).toBe('PEN')
    expect(created?.category).toBe('API')
    expect(created?.merchant).toBe('Cafe')
  })
})
