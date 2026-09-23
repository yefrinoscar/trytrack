import { afterAll, beforeAll, describe, expect, test } from 'vite-plus/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Public recurring-payments API. Same shared key as the expenses endpoint.
 */
let dir: string
let handleCreate: (request: Request) => Promise<Response>
let handleDelete: (request: Request) => Promise<Response>

const KEY = 'test-api-key-1234567890'
const EMAIL = 'recurring@test.local'

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'trytrack-rp-'))
  process.env.LOCAL_DB_PATH = join(dir, 'rp.db')
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
    id: 'rp-user',
    email: EMAIL,
    name: 'Recurring',
    currency: 'PEN',
    createdAt: now,
    updatedAt: now,
  })

  const route = await import('#/routes/api/v1/recurring-payments')
  handleCreate = route.handleCreateRecurringPayment
  handleDelete = route.handleDeleteRecurringPayment
})

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
  delete process.env.EXPENSES_API_KEY
})

function post(body: unknown, key = KEY) {
  return handleCreate(
    new Request('https://trytrack.test/api/v1/recurring-payments', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(key ? { authorization: `Bearer ${key}` } : {}),
      },
      body: JSON.stringify(body),
    }),
  )
}

function del(query: string, key = KEY) {
  return handleDelete(
    new Request(`https://trytrack.test/api/v1/recurring-payments${query}`, {
      method: 'DELETE',
      headers: key ? { authorization: `Bearer ${key}` } : {},
    }),
  )
}

const valid = {
  email: EMAIL,
  name: 'Netflix',
  amount: 15.99,
  currency: 'pen',
  dueDay: 5,
  startDate: '2026-01-01',
}

describe('public recurring payments API', () => {
  test('rejects a missing or wrong key', async () => {
    expect((await post(valid, '')).status).toBe(401)
    expect((await del('?id=x', 'wrong-key-000000000000')).status).toBe(401)
  })

  test('validates required fields', async () => {
    const res = await post({ email: EMAIL })
    expect(res.status).toBe(422)
    const body = (await res.json()) as { fields: Record<string, string> }
    expect(Object.keys(body.fields).sort()).toEqual(
      ['amount', 'currency', 'dueDay', 'name', 'startDate'].sort(),
    )
  })

  test('rejects an out-of-range dueDay and a bad status', async () => {
    const res = await post({ ...valid, dueDay: 45, status: 'weekly' })
    expect(res.status).toBe(422)
    const body = (await res.json()) as { fields: Record<string, string> }
    expect(body.fields.dueDay).toBeDefined()
    expect(body.fields.status).toBeDefined()
  })

  test('returns 404 for an unknown account', async () => {
    expect((await post({ ...valid, email: 'nobody@test.local' })).status).toBe(
      404,
    )
  })

  test('creates a recurring payment and normalises values', async () => {
    const res = await post({ ...valid, category: 'Subscription' })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { ok: boolean; id: string }
    expect(body.ok).toBe(true)

    const { getDb } = await import('#/server/db/client')
    const { recurringPayments } = await import('#/server/db/schema')
    const db = await getDb()
    const rows = await db.select().from(recurringPayments)
    const created = rows.find((row) => row.id === body.id)

    expect(created?.userId).toBe('rp-user')
    expect(created?.currency).toBe('PEN')
    expect(created?.amount).toBe(15.99)
    expect(created?.dueDay).toBe(5)
    expect(created?.cadence).toBe('monthly')
    expect(created?.status).toBe('active')
    expect(created?.category).toBe('Subscription')
  })

  test('defaults the category to Recurring', async () => {
    const res = await post({ ...valid, name: 'Rent', category: undefined })
    const body = (await res.json()) as { id: string }
    expect(res.status).toBe(201)

    const { getDb } = await import('#/server/db/client')
    const { recurringPayments } = await import('#/server/db/schema')
    const db = await getDb()
    const rows = await db.select().from(recurringPayments)
    expect(rows.find((row) => row.id === body.id)?.category).toBe('Recurring')
  })

  test('deletes one by id', async () => {
    const created = (await (await post(valid)).json()) as { id: string }

    const res = await del(`?id=${created.id}`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, deleted: 1 })
    expect((await del(`?id=${created.id}`)).status).toBe(404)
  })

  test('deletes by email plus a filter, and needs a filter', async () => {
    await post({ ...valid, name: 'Spotify', status: 'cancelled' })
    await post({ ...valid, name: 'Phone', status: 'cancelled' })

    const noFilter = await del(`?email=${EMAIL}`)
    expect(noFilter.status).toBe(422)

    const res = await del(`?email=${EMAIL}&status=cancelled`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, deleted: 2 })
  })
})
