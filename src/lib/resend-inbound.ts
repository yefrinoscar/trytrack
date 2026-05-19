import { logError, logInfo, logWarn } from './server-logger'

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

type ResendWebhookEvent =
  | ResendEmailReceivedEvent
  | {
      type?: string
      created_at?: string
      data?: unknown
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
  const secret = process.env.RESEND_WEBHOOK_SECRET

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

async function retrieveReceivedEmail(emailId: string, request: Request) {
  const apiKey = process.env.RESEND_API_KEY

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

  logInfo({
    event: 'resend.email.received',
    message: 'Received inbound email event from Resend.',
    request,
    context: {
      ...summary,
      retrieved: Boolean(retrievedEmail),
      content: retrievedSummary,
    },
  })

  return jsonResponse({
    ok: true,
    event: 'email.received',
    email: summary,
    content: retrievedSummary,
  })
}
