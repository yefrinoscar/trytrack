import { createFileRoute } from '@tanstack/react-router'
import { backfillResendReceivedEmails } from '#/lib/resend-inbound'

type RuntimeGlobal = typeof globalThis & {
  __env__?: Record<string, unknown>
}

type CloudflareRuntimeRequest = Request & {
  runtime?: {
    cloudflare?: {
      env?: Record<string, unknown>
    }
  }
}

function getRuntimeEnv(name: string, request?: Request) {
  const processValue = process.env[name]

  if (processValue) {
    return processValue
  }

  const requestValue = (request as CloudflareRuntimeRequest | undefined)
    ?.runtime?.cloudflare?.env?.[name]

  if (typeof requestValue === 'string') {
    return requestValue
  }

  const cloudflareValue = (globalThis as RuntimeGlobal).__env__?.[name]

  return typeof cloudflareValue === 'string' ? cloudflareValue : undefined
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...init?.headers,
    },
  })
}

function parseDate(value: unknown) {
  return typeof value === 'string' && value ? new Date(value) : null
}

async function handleEmailBackfill(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 })
  }

  if (request.method !== 'POST') {
    return jsonResponse(
      { error: 'Method not allowed. Use POST.' },
      { status: 405, headers: { allow: 'POST, OPTIONS' } },
    )
  }

  const secret = getRuntimeEnv('RESEND_BACKFILL_SECRET', request)
  if (!secret) {
    return jsonResponse(
      { error: 'RESEND_BACKFILL_SECRET is not configured.' },
      { status: 501 },
    )
  }

  const authorization = request.headers.get('authorization')
  if (authorization !== `Bearer ${secret}`) {
    return jsonResponse({ error: 'Unauthorized.' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >
  const start = parseDate(body.start) ?? new Date('2026-05-01T00:00:00.000Z')
  const end = parseDate(body.end) ?? new Date('2026-06-01T00:00:00.000Z')

  return await backfillResendReceivedEmails({ end, request, start })
}

export const Route = createFileRoute('/api/email/backfill')({
  server: {
    handlers: {
      OPTIONS: ({ request }) => handleEmailBackfill(request),
      POST: ({ request }) => handleEmailBackfill(request),
    },
  },
})
