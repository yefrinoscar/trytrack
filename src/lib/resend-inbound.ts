import { logError, logInfo, logWarn } from './server-logger'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../convex/_generated/api'
import { parseEmailExpense } from './email-expense-parser'

interface ResendAttachmentMetadata {
  id?: string
  filename?: string
  content_type?: string
  content_disposition?: string | null
  content_id?: string | null
}

interface ResendEmailReceivedEvent {
  type: 'email.received'
  created_at?: string
  data: {
    email_id: string
    created_at?: string
    from?: string
    to?: string[]
    bcc?: string[]
    cc?: string[]
    message_id?: string
    subject?: string
    attachments?: ResendAttachmentMetadata[]
  }
}

interface ResendReceivedEmail {
  object?: 'email'
  id: string
  to?: string[]
  from?: string
  created_at?: string
  subject?: string
  html?: string | null
  text?: string | null
  headers?: Record<string, string>
  bcc?: string[]
  cc?: string[]
  reply_to?: string[]
  message_id?: string
  raw?: {
    download_url?: string
    expires_at?: string
  } | null
  attachments?: ResendAttachmentMetadata[]
}

interface ResendReceivedEmailListItem {
  id: string
  to?: string[]
  from?: string
  created_at?: string
  subject?: string
  bcc?: string[]
  cc?: string[]
  reply_to?: string[]
  message_id?: string
  attachments?: ResendAttachmentMetadata[]
}

interface ResendReceivedEmailList {
  object?: 'list'
  has_more?: boolean
  data?: ResendReceivedEmailListItem[]
}

type ResendWebhookEvent =
  | ResendEmailReceivedEvent
  | {
      type?: string
      created_at?: string
      data?: unknown
    }

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

function timingSafeEqual(left: string, right: string) {
  const leftBytes = new TextEncoder().encode(left)
  const rightBytes = new TextEncoder().encode(right)

  if (leftBytes.length !== rightBytes.length) {
    return false
  }

  let diff = 0
  for (let index = 0; index < leftBytes.length; index += 1) {
    diff |= leftBytes[index]! ^ rightBytes[index]!
  }

  return diff === 0
}

function base64ToBytes(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

function getWebhookSecretBytes(secret: string) {
  const normalized = secret.startsWith('whsec_') ? secret.slice(6) : secret

  try {
    return base64ToBytes(normalized)
  } catch {
    return new TextEncoder().encode(secret)
  }
}

async function createSvixSignature({
  payload,
  secret,
  svixId,
  svixTimestamp,
}: {
  payload: string
  secret: string
  svixId: string
  svixTimestamp: string
}) {
  const key = await crypto.subtle.importKey(
    'raw',
    getWebhookSecretBytes(secret),
    { hash: 'SHA-256', name: 'HMAC' },
    false,
    ['sign'],
  )
  const signedContent = `${svixId}.${svixTimestamp}.${payload}`
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(signedContent),
  )
  const signatureBytes = new Uint8Array(signatureBuffer)
  let binary = ''

  for (const byte of signatureBytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
}

async function verifyResendSignature(request: Request, payload: string) {
  const secret = getRuntimeEnv('RESEND_WEBHOOK_SECRET', request)

  if (!secret) {
    logWarn({
      event: 'resend.webhook.unverified',
      message: 'RESEND_WEBHOOK_SECRET is not configured; accepting webhook.',
      request,
    })
    return true
  }

  const svixId = request.headers.get('svix-id')
  const svixTimestamp = request.headers.get('svix-timestamp')
  const svixSignature = request.headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return false
  }

  const expected = await createSvixSignature({
    payload,
    secret,
    svixId,
    svixTimestamp,
  })

  return svixSignature
    .split(' ')
    .some((signature) =>
      timingSafeEqual(signature.replace(/^v\d+,/, ''), expected),
    )
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

function truncate(value: string | null | undefined, maxLength = 500) {
  if (!value) {
    return null
  }

  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value
}

function parseResendTimestamp(value: string | undefined) {
  if (!value) {
    return Number.NaN
  }

  const normalized = value
    .replace(' ', 'T')
    .replace(/(\.\d{3})\d+/, '$1')
    .replace(/([+-]\d{2})$/, '$1:00')

  return Date.parse(normalized)
}

function summarizeRetrievedEmail(email: ResendReceivedEmail | null) {
  if (!email) {
    return null
  }

  return {
    id: email.id,
    from: email.from ?? null,
    to: email.to ?? [],
    cc: email.cc ?? [],
    bcc: email.bcc ?? [],
    replyTo: email.reply_to ?? [],
    subject: email.subject ?? null,
    createdAt: email.created_at ?? null,
    messageId: email.message_id ?? null,
    textSnippet: truncate(email.text, 700),
    htmlSnippet: truncate(email.html, 700),
    headers: email.headers ?? {},
    raw: email.raw ?? null,
    attachments: email.attachments ?? [],
  }
}

async function listReceivedEmails({
  after,
  request,
}: {
  after?: string
  request: Request
}) {
  const apiKey = getRuntimeEnv('RESEND_API_KEY', request)

  if (!apiKey) {
    logWarn({
      event: 'resend.received_email.list_skipped',
      message: 'RESEND_API_KEY is not configured; skipping email list.',
      request,
    })
    return null
  }

  const url = new URL('https://api.resend.com/emails/receiving')
  url.searchParams.set('limit', '100')
  if (after) {
    url.searchParams.set('after', after)
  }

  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    method: 'GET',
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(
      `Resend received email list failed with ${response.status}: ${truncate(errorText, 300) ?? ''}`,
    )
  }

  return (await response.json()) as ResendReceivedEmailList
}

async function retrieveReceivedEmail(emailId: string, request: Request) {
  const apiKey = getRuntimeEnv('RESEND_API_KEY', request)

  if (!apiKey) {
    logWarn({
      event: 'resend.received_email.not_retrieved',
      message: 'RESEND_API_KEY is not configured; skipping email retrieval.',
      request,
      context: { emailId },
    })
    return null
  }

  const response = await fetch(
    `https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`,
    {
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      method: 'GET',
    },
  )

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(
      `Resend received email retrieval failed with ${response.status}: ${truncate(errorText, 300) ?? ''}`,
    )
  }

  return (await response.json()) as ResendReceivedEmail
}

async function saveEmailExpenseImport({
  email,
  request,
  summary,
}: {
  email: ResendReceivedEmail
  request: Request
  summary: ReturnType<typeof summarizeReceivedEmail>
}) {
  const convexUrl =
    getRuntimeEnv('VITE_CONVEX_URL', request) ??
    getRuntimeEnv('CONVEX_URL', request)

  if (!convexUrl) {
    logWarn({
      event: 'resend.email_import.not_saved',
      message: 'VITE_CONVEX_URL is not configured; skipping import save.',
      request,
      context: { emailId: summary.emailId },
    })
    return null
  }

  const parsed = parseEmailExpense({
    text: email.text ?? '',
    from: email.from ?? summary.from,
  })

  if (!parsed.ownerEmail) {
    logWarn({
      event: 'resend.email_import.no_owner',
      message: 'Could not detect the TryTrack owner email from inbound email.',
      request,
      context: { emailId: summary.emailId, parserError: parsed.error ?? null },
    })
    return null
  }

  if (parsed.ignore) {
    logInfo({
      event: 'resend.email_import.ignored',
      message: 'Parsed email was intentionally ignored.',
      request,
      context: { emailId: summary.emailId, parserError: parsed.error ?? null },
    })
    return null
  }

  const client = new ConvexHttpClient(convexUrl)

  return await client.mutation(api.expenses.importFromEmail, {
    userEmail: parsed.ownerEmail,
    provider: 'resend',
    emailId: summary.emailId,
    ...(summary.messageId ? { messageId: summary.messageId } : {}),
    ...(summary.from ? { from: summary.from } : {}),
    to: summary.to,
    ...(summary.subject ? { subject: summary.subject } : {}),
    ...(email.text ? { textSnippet: truncate(email.text, 2000) ?? '' } : {}),
    ...(email.html ? { htmlSnippet: truncate(email.html, 2000) ?? '' } : {}),
    ...(parsed.merchant ? { merchant: parsed.merchant } : {}),
    ...(typeof parsed.amount === 'number' ? { amount: parsed.amount } : {}),
    ...(parsed.currency ? { currency: parsed.currency } : {}),
    ...(parsed.spentAt ? { spentAt: parsed.spentAt } : {}),
    ...(parsed.occurredAt ? { occurredAt: parsed.occurredAt } : {}),
    ...(parsed.source ? { source: parsed.source } : {}),
    ...(() => {
      const dedupeKey = createEmailExpenseDedupeKey({
        amount: parsed.amount,
        currency: parsed.currency,
        merchant: parsed.merchant,
        ownerEmail: parsed.ownerEmail,
        source: parsed.source,
        spentAt: parsed.spentAt,
      })
      return dedupeKey ? { dedupeKey } : {}
    })(),
    ...(parsed.error ? { error: parsed.error } : {}),
  })
}

function summarizeListItemEmail(email: ResendReceivedEmailListItem) {
  return {
    emailId: email.id,
    messageId: email.message_id ?? null,
    from: email.from ?? null,
    to: email.to ?? [],
    cc: email.cc ?? [],
    bcc: email.bcc ?? [],
    subject: email.subject ?? null,
    receivedAt: email.created_at ?? null,
    attachments: email.attachments ?? [],
  }
}

function createEmailExpenseDedupeKey({
  amount,
  currency,
  merchant,
  ownerEmail,
  source,
  spentAt,
}: {
  amount?: number
  currency?: string
  merchant?: string
  ownerEmail: string
  source?: string
  spentAt?: string
}) {
  if (!amount || !currency || !merchant || !source || !spentAt) {
    return undefined
  }

  return [
    ownerEmail.toLowerCase(),
    source,
    merchant
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/^PLIN-/i, '')
      .replace(/[^a-z0-9]+/gi, ' ')
      .trim()
      .toLowerCase(),
    currency,
    amount.toFixed(2),
    spentAt,
  ].join('|')
}

function summarizeReceivedEmail(event: ResendEmailReceivedEvent) {
  return {
    emailId: event.data.email_id,
    messageId: event.data.message_id ?? null,
    from: event.data.from ?? null,
    to: event.data.to ?? [],
    cc: event.data.cc ?? [],
    bcc: event.data.bcc ?? [],
    subject: event.data.subject ?? null,
    receivedAt: event.data.created_at ?? event.created_at ?? null,
    attachments: event.data.attachments ?? [],
  }
}

function isEmailReceivedEvent(
  event: ResendWebhookEvent,
): event is ResendEmailReceivedEvent {
  return (
    event.type === 'email.received' &&
    typeof event.data === 'object' &&
    event.data !== null &&
    'email_id' in event.data &&
    typeof event.data.email_id === 'string'
  )
}

export async function backfillResendReceivedEmails({
  end,
  request,
  start,
}: {
  end: Date
  request: Request
  start: Date
}) {
  const startMs = start.getTime()
  const endMs = end.getTime()

  if (
    !Number.isFinite(startMs) ||
    !Number.isFinite(endMs) ||
    startMs >= endMs
  ) {
    return jsonResponse(
      { error: 'Invalid date range. Use start before end.' },
      { status: 400 },
    )
  }

  let after: string | undefined
  let scanned = 0
  let matched = 0
  let saved = 0
  let skippedWithoutContent = 0
  let stoppedAtOlderEmail = false

  while (true) {
    const page = await listReceivedEmails({ after, request })

    if (!page) {
      return jsonResponse(
        { error: 'RESEND_API_KEY is not configured.' },
        { status: 501 },
      )
    }

    const items = page?.data ?? []

    if (!items.length) {
      break
    }

    for (const item of items) {
      scanned += 1
      const receivedMs = parseResendTimestamp(item.created_at)

      if (!Number.isFinite(receivedMs)) {
        continue
      }

      if (receivedMs < startMs) {
        stoppedAtOlderEmail = true
        break
      }

      if (receivedMs >= endMs) {
        continue
      }

      matched += 1
      const email = await retrieveReceivedEmail(item.id, request)

      if (!email) {
        skippedWithoutContent += 1
        continue
      }

      const importId = await saveEmailExpenseImport({
        email,
        request,
        summary: summarizeListItemEmail(item),
      })

      if (importId) {
        saved += 1
      }
    }

    if (stoppedAtOlderEmail || !page?.has_more) {
      break
    }

    after = items.at(-1)?.id
    if (!after) {
      break
    }
  }

  return jsonResponse({
    ok: true,
    scanned,
    matched,
    saved,
    skippedWithoutContent,
    range: {
      start: start.toISOString(),
      end: end.toISOString(),
    },
  })
}

export async function handleResendInboundEmail(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 })
  }

  if (request.method !== 'POST') {
    return jsonResponse(
      { error: 'Method not allowed. Use POST.' },
      { status: 405, headers: { allow: 'POST, OPTIONS' } },
    )
  }

  const payload = await request.text()
  const isValidWebhook = await verifyResendSignature(request, payload)

  if (!isValidWebhook) {
    logWarn({
      event: 'resend.webhook.invalid_signature',
      message: 'Rejected Resend webhook with invalid signature.',
      request,
    })
    return jsonResponse(
      { error: 'Invalid webhook signature.' },
      { status: 400 },
    )
  }

  let event: ResendWebhookEvent
  try {
    event = JSON.parse(payload) as ResendWebhookEvent
  } catch (error) {
    logError({
      event: 'resend.webhook.invalid_json',
      message: 'Rejected Resend webhook with invalid JSON.',
      request,
      error,
    })
    return jsonResponse({ error: 'Invalid JSON payload.' }, { status: 400 })
  }

  if (!isEmailReceivedEvent(event)) {
    logInfo({
      event: 'resend.webhook.ignored',
      message: 'Ignored unsupported Resend webhook event.',
      request,
      context: { type: event.type ?? null },
    })
    return jsonResponse({ ok: true, ignored: true })
  }

  const summary = summarizeReceivedEmail(event)
  let retrievedEmail: ResendReceivedEmail | null = null

  try {
    retrievedEmail = await retrieveReceivedEmail(summary.emailId, request)
  } catch (error) {
    logError({
      event: 'resend.received_email.retrieve_failed',
      message: 'Failed to retrieve full inbound email from Resend.',
      request,
      context: { emailId: summary.emailId },
      error,
    })
    return jsonResponse(
      { error: 'Could not retrieve received email from Resend.' },
      { status: 502 },
    )
  }

  const retrievedSummary = summarizeRetrievedEmail(retrievedEmail)
  let importId: string | null = null

  if (retrievedEmail) {
    try {
      importId = await saveEmailExpenseImport({
        email: retrievedEmail,
        request,
        summary,
      })
    } catch (error) {
      logError({
        event: 'resend.email_import.save_failed',
        message: 'Failed to save parsed email expense import.',
        request,
        context: { emailId: summary.emailId },
        error,
      })
    }
  }

  logInfo({
    event: 'resend.email.received',
    message: 'Received inbound email event from Resend.',
    request,
    context: {
      ...summary,
      retrieved: Boolean(retrievedEmail),
      importId,
      content: retrievedSummary,
    },
  })

  return jsonResponse({
    ok: true,
    event: 'email.received',
    email: summary,
    importId,
    content: retrievedSummary,
  })
}
