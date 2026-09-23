import { createFileRoute } from '@tanstack/react-router'
import {
  createForApi,
  removeByIdForApi,
  removeMatchingForApi,
} from '#/server/api/recurringPayments'
import { findUserByEmail } from '#/server/api/users'
import {
  API_DISABLED_MESSAGE,
  asTrimmedString,
  isApiAuthorized,
  isApiKeyConfigured,
  jsonResponse,
} from '#/server/api-key'

/**
 * Public API to register and delete recurring payments (monthly charges such
 * as rent or subscriptions).
 *
 *   POST   /api/v1/recurring-payments
 *   DELETE /api/v1/recurring-payments?id=<id>
 *   DELETE /api/v1/recurring-payments?email=you@example.com&status=cancelled
 *
 * Same `EXPENSES_API_KEY` and `Authorization: Bearer <key>` header as the
 * expenses endpoint.
 */

type Payload = {
  email?: unknown
  name?: unknown
  amount?: unknown
  currency?: unknown
  dueDay?: unknown
  startDate?: unknown
  endDate?: unknown
  category?: unknown
  status?: unknown
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const CURRENCY_PATTERN = /^[A-Za-z]{3}$/
const STATUSES = ['active', 'paused', 'cancelled'] as const

function guard() {
  if (!isApiKeyConfigured()) {
    return jsonResponse({ error: API_DISABLED_MESSAGE }, 503)
  }
  return null
}

export async function handleCreateRecurringPayment(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 })
  }

  const blocked = guard()
  if (blocked) {
    return blocked
  }

  if (!isApiAuthorized(request)) {
    return jsonResponse({ error: 'Unauthorized.' }, 401)
  }

  let payload: Payload
  try {
    payload = (await request.json()) as Payload
  } catch {
    return jsonResponse({ error: 'Body must be valid JSON.' }, 400)
  }

  const email = asTrimmedString(payload.email).toLowerCase()
  const name = asTrimmedString(payload.name)
  const currency = asTrimmedString(payload.currency).toUpperCase()
  const startDate = asTrimmedString(payload.startDate)
  const endDate = asTrimmedString(payload.endDate)
  const category = asTrimmedString(payload.category) || 'Recurring'
  const status = (asTrimmedString(payload.status) || 'active').toLowerCase()
  const amount = Number(payload.amount)
  const dueDay = Number(payload.dueDay)

  const fields: Record<string, string> = {}
  if (!email) fields.email = 'Required.'
  if (!name) fields.name = 'Required.'
  if (!Number.isFinite(amount) || amount <= 0) {
    fields.amount = 'Required. Must be a number greater than 0.'
  }
  if (!currency) {
    fields.currency = 'Required.'
  } else if (!CURRENCY_PATTERN.test(currency)) {
    fields.currency = 'Must be a 3-letter code, for example PEN or USD.'
  }
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
    fields.dueDay = 'Required. Must be an integer between 1 and 31.'
  }
  if (!startDate) {
    fields.startDate = 'Required.'
  } else if (!DATE_PATTERN.test(startDate)) {
    fields.startDate = 'Must use YYYY-MM-DD format.'
  }
  if (endDate && !DATE_PATTERN.test(endDate)) {
    fields.endDate = 'Must use YYYY-MM-DD format.'
  }
  if (!STATUSES.includes(status as (typeof STATUSES)[number])) {
    fields.status = `Must be one of: ${STATUSES.join(', ')}.`
  }

  if (Object.keys(fields).length > 0) {
    return jsonResponse({ error: 'Validation failed.', fields }, 422)
  }

  const user = await findUserByEmail(email)
  if (!user) {
    return jsonResponse({ error: `No account found for ${email}.` }, 404)
  }

  const id = await createForApi({
    userId: user.id,
    name,
    category,
    currency,
    amount: Math.round(amount * 100) / 100,
    dueDay,
    startDate,
    ...(endDate ? { endDate } : {}),
    status: status as 'active' | 'paused' | 'cancelled',
  })

  return jsonResponse({ ok: true, id }, 201)
}

export async function handleDeleteRecurringPayment(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 })
  }

  const blocked = guard()
  if (blocked) {
    return blocked
  }

  if (!isApiAuthorized(request)) {
    return jsonResponse({ error: 'Unauthorized.' }, 401)
  }

  const params = new URL(request.url).searchParams
  const id = asTrimmedString(params.get('id'))
  const email = asTrimmedString(params.get('email')).toLowerCase()
  const name = asTrimmedString(params.get('name'))
  const category = asTrimmedString(params.get('category'))
  const currency = asTrimmedString(params.get('currency'))
  const status = asTrimmedString(params.get('status'))

  if (id) {
    const deleted = await removeByIdForApi(id)
    if (!deleted) {
      return jsonResponse(
        { error: `No recurring payment found with id ${id}.` },
        404,
      )
    }
    return jsonResponse({ ok: true, deleted: 1 })
  }

  if (!email) {
    return jsonResponse(
      {
        error:
          'Provide ?id= to delete one recurring payment, or ?email= plus a filter.',
      },
      422,
    )
  }

  if (!name && !category && !currency && !status) {
    return jsonResponse(
      {
        error:
          'Deleting by email needs at least one filter: name, category, currency or status.',
      },
      422,
    )
  }

  const user = await findUserByEmail(email)
  if (!user) {
    return jsonResponse({ error: `No account found for ${email}.` }, 404)
  }

  const deleted = await removeMatchingForApi({
    userId: user.id,
    ...(name ? { name } : {}),
    ...(category ? { category } : {}),
    ...(currency ? { currency } : {}),
    ...(status ? { status } : {}),
  })

  return jsonResponse({ ok: true, deleted })
}

export const Route = createFileRoute('/api/v1/recurring-payments')({
  server: {
    handlers: {
      DELETE: ({ request }) => handleDeleteRecurringPayment(request),
      OPTIONS: ({ request }) => handleCreateRecurringPayment(request),
      POST: ({ request }) => handleCreateRecurringPayment(request),
    },
  },
})
