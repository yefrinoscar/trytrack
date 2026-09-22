import { createFileRoute } from '@tanstack/react-router'
import {
  createForUser,
  removeByIdForApi,
  removeMatchingForApi,
} from '#/server/api/expenses'
import { findUserByEmail } from '#/server/api/users'
import { getEnv } from '#/server/env'

/**
 * Public API to register an expense from outside the browser session.
 *
 *   POST /api/v1/expenses
 *   Authorization: Bearer <EXPENSES_API_KEY>
 *   Content-Type: application/json
 *
 *   {
 *     "email": "you@example.com",
 *     "amount": 42.5,
 *     "currency": "USD",
 *     "description": "Lunch",
 *     "category": "Food",
 *     "merchant": "Cafe",
 *     "spentAt": "2026-09-22"
 *   }
 *
 * Authenticates with a single shared key stored as the `EXPENSES_API_KEY`
 * Worker secret, so it never runs without a configured key.
 */

type Payload = {
  email?: unknown
  amount?: unknown
  currency?: unknown
  description?: unknown
  category?: unknown
  merchant?: unknown
  spentAt?: unknown
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const CURRENCY_PATTERN = /^[A-Za-z]{3}$/

function isAuthorized(request: Request) {
  const expected = getEnv('EXPENSES_API_KEY')
  if (!expected) {
    return false
  }

  const header = request.headers.get('authorization') ?? ''
  const provided = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!provided) {
    return false
  }

  // Constant-time-ish comparison: avoids trivially leaking length differences.
  if (provided.length !== expected.length) {
    return false
  }
  let diff = 0
  for (let i = 0; i < provided.length; i += 1) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return diff === 0
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status })
}

function asTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function handleCreateExpense(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 })
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed. Use POST.' }, 405)
  }

  if (!getEnv('EXPENSES_API_KEY')) {
    return json(
      {
        error:
          'The expense API is disabled: EXPENSES_API_KEY is not configured.',
      },
      503,
    )
  }

  if (!isAuthorized(request)) {
    return json({ error: 'Unauthorized.' }, 401)
  }

  let payload: Payload
  try {
    payload = (await request.json()) as Payload
  } catch {
    return json({ error: 'Body must be valid JSON.' }, 400)
  }

  const email = asTrimmedString(payload.email).toLowerCase()
  const description = asTrimmedString(payload.description)
  const currency = asTrimmedString(payload.currency).toUpperCase()
  const category = asTrimmedString(payload.category) || 'API'
  const merchant = asTrimmedString(payload.merchant)
  const spentAt = asTrimmedString(payload.spentAt)
  const amount = Number(payload.amount)

  const fields: Record<string, string> = {}
  if (!email) fields.email = 'Required.'
  if (!description) fields.description = 'Required.'
  if (!Number.isFinite(amount) || amount <= 0) {
    fields.amount = 'Required. Must be a number greater than 0.'
  }
  if (!currency) {
    fields.currency = 'Required.'
  } else if (!CURRENCY_PATTERN.test(currency)) {
    fields.currency = 'Must be a 3-letter code, for example USD or PEN.'
  }
  if (!spentAt) {
    fields.spentAt = 'Required.'
  } else if (!DATE_PATTERN.test(spentAt)) {
    fields.spentAt = 'Must use YYYY-MM-DD format.'
  }

  if (Object.keys(fields).length > 0) {
    return json({ error: 'Validation failed.', fields }, 422)
  }

  const user = await findUserByEmail(email)
  if (!user) {
    return json({ error: `No account found for ${email}.` }, 404)
  }

  const id = await createForUser({
    userId: user.id,
    amount: Math.round(amount * 100) / 100,
    currency,
    description,
    category,
    ...(merchant ? { merchant } : {}),
    spentAt,
  })

  return json({ ok: true, id }, 201)
}

/**
 * Deletes expenses. Same key as the create endpoint.
 *
 *   DELETE /api/v1/expenses?id=<expenseId>
 *   DELETE /api/v1/expenses?email=you@example.com&spentAt=2026-09-22
 *   DELETE /api/v1/expenses?email=you@example.com&category=Other
 *
 * Deleting by `id` removes a single expense. Deleting by `email` requires at
 * least one more filter, so a typo cannot wipe every expense by accident.
 */
export async function handleDeleteExpense(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 })
  }

  if (!getEnv('EXPENSES_API_KEY')) {
    return json(
      {
        error:
          'The expense API is disabled: EXPENSES_API_KEY is not configured.',
      },
      503,
    )
  }

  if (!isAuthorized(request)) {
    return json({ error: 'Unauthorized.' }, 401)
  }

  const params = new URL(request.url).searchParams
  const id = asTrimmedString(params.get('id'))
  const email = asTrimmedString(params.get('email')).toLowerCase()
  const spentAt = asTrimmedString(params.get('spentAt'))
  const category = asTrimmedString(params.get('category'))
  const currency = asTrimmedString(params.get('currency'))
  const description = asTrimmedString(params.get('description'))

  if (id) {
    const deleted = await removeByIdForApi(id)
    if (!deleted) {
      return json({ error: `No expense found with id ${id}.` }, 404)
    }
    return json({ ok: true, deleted: 1 })
  }

  if (!email) {
    return json(
      {
        error: 'Provide ?id= to delete one expense, or ?email= plus a filter.',
      },
      422,
    )
  }

  if (!spentAt && !category && !currency && !description) {
    return json(
      {
        error:
          'Deleting by email needs at least one filter: spentAt, category, currency or description.',
      },
      422,
    )
  }

  const user = await findUserByEmail(email)
  if (!user) {
    return json({ error: `No account found for ${email}.` }, 404)
  }

  const deleted = await removeMatchingForApi({
    userId: user.id,
    ...(spentAt ? { spentAt } : {}),
    ...(category ? { category } : {}),
    ...(currency ? { currency } : {}),
    ...(description ? { description } : {}),
  })

  return json({ ok: true, deleted })
}

export const Route = createFileRoute('/api/v1/expenses')({
  server: {
    handlers: {
      DELETE: ({ request }) => handleDeleteExpense(request),
      OPTIONS: ({ request }) => handleCreateExpense(request),
      POST: ({ request }) => handleCreateExpense(request),
    },
  },
})
