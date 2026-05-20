import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../convex/_generated/api'
import { parseEmailExpense } from './email-expense-parser'

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

interface GmailHeader {
  name?: string | null
  value?: string | null
}

interface GmailMessagePart {
  mimeType?: string | null
  body?: {
    data?: string | null
  } | null
  parts?: GmailMessagePart[] | null
}

interface GmailMessage {
  id?: string | null
  payload?: {
    headers?: GmailHeader[] | null
    mimeType?: string | null
    body?: {
      data?: string | null
    } | null
    parts?: GmailMessagePart[] | null
  } | null
}

interface GmailHistoryEntry {
  messagesAdded?: Array<{
    message?: {
      id?: string | null
    } | null
  }> | null
}

interface PubSubPushBody {
  message?: {
    data?: string
    messageId?: string
    publishTime?: string
  }
  subscription?: string
}

const DEFAULT_BANK_QUERY =
  '(from:notificaciones@yape.pe OR from:procesos@bbva.com.pe OR from:yape@bcp.com.pe OR from:notificaciones@notificacionesbcp.com.pe OR yape OR bbva OR plin)'

class GmailApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'GmailApiError'
    this.status = status
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

function errorJsonResponse(error: unknown) {
  if (error instanceof GmailApiError) {
    return jsonResponse(
      {
        error: error.message,
        status: error.status,
      },
      { status: error.status },
    )
  }

  return jsonResponse(
    {
      error: error instanceof Error ? error.message : 'Unknown error',
    },
    { status: 500 },
  )
}

function getRequiredEnv(name: string, request?: Request) {
  const value = getRuntimeEnv(name, request)

  if (!value) {
    throw new Error(`${name} is not configured.`)
  }

  return value
}

function getConvexClient(request?: Request) {
  return new ConvexHttpClient(
    getRuntimeEnv('VITE_CONVEX_URL', request) ??
      getRequiredEnv('CONVEX_URL', request),
  )
}

function getOwnerEmail(request?: Request, fallback?: string) {
  return (
    getRuntimeEnv('OWNER_EMAIL', request) ??
    getRuntimeEnv('GMAIL_USER_EMAIL', request) ??
    fallback
  )?.toLowerCase()
}

function decodeBase64Url(value: string) {
  return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
    .toString('utf8')
    .replace(/\r/g, '')
}

function collectParts(part: GmailMessagePart | undefined | null) {
  const texts = { html: [] as string[], plain: [] as string[] }

  function visit(current: GmailMessagePart | undefined | null) {
    if (!current) {
      return
    }

    const bodyData = current.body?.data
    if (bodyData && current.mimeType === 'text/plain') {
      texts.plain.push(decodeBase64Url(bodyData))
    }
    if (bodyData && current.mimeType === 'text/html') {
      texts.html.push(decodeBase64Url(bodyData))
    }

    for (const child of current.parts ?? []) {
      visit(child)
    }
  }

  visit(part)

  return texts
}

function htmlToText(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function getHeader(message: GmailMessage, name: string) {
  return (
    message.payload?.headers?.find(
      (header) => header.name?.toLowerCase() === name.toLowerCase(),
    )?.value ?? undefined
  )
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

async function getGmailAccessToken(request?: Request) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    body: new URLSearchParams({
      client_id: getRequiredEnv('GMAIL_CLIENT_ID', request),
      client_secret: getRequiredEnv('GMAIL_CLIENT_SECRET', request),
      grant_type: 'refresh_token',
      refresh_token: getRequiredEnv('GMAIL_REFRESH_TOKEN', request),
    }),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    method: 'POST',
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(
      `Gmail token refresh failed: ${response.status} ${errorText}`,
    )
  }

  const body = (await response.json()) as { access_token?: string }

  if (!body.access_token) {
    throw new Error('Gmail token refresh did not return an access token.')
  }

  return body.access_token
}

async function gmailRequest<T>(
  path: string,
  request?: Request,
  init?: RequestInit,
) {
  const accessToken = await getGmailAccessToken(request)
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/${path}`,
    {
      ...init,
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
        ...init?.headers,
      },
    },
  )

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new GmailApiError(
      response.status,
      `Gmail API failed: ${response.status} ${errorText}`,
    )
  }

  return (await response.json()) as T
}

async function getGmailMessage(id: string, request?: Request) {
  return await gmailRequest<GmailMessage>(
    `users/me/messages/${encodeURIComponent(id)}?format=full`,
    request,
  )
}

async function saveGmailMessageExpense({
  client,
  message,
  ownerEmail,
}: {
  client: ConvexHttpClient
  message: GmailMessage
  ownerEmail: string
}) {
  const messageId = message.id
  if (!messageId) {
    return { saved: false, skipped: true }
  }

  const parts = collectParts(message.payload)
  const text = parts.plain.join('\n\n') || htmlToText(parts.html.join('\n\n'))
  const parsed = parseEmailExpense({ from: getHeader(message, 'From'), text })

  if (parsed.ignore || !parsed.amount || !parsed.currency || !parsed.spentAt) {
    return {
      saved: false,
      skipped: true,
      reason: parsed.error ?? 'not parsed',
      subject: getHeader(message, 'Subject'),
    }
  }

  await client.mutation(api.expenses.importFromEmail, {
    amount: parsed.amount,
    currency: parsed.currency,
    dedupeKey: createEmailExpenseDedupeKey({
      amount: parsed.amount,
      currency: parsed.currency,
      merchant: parsed.merchant,
      ownerEmail,
      source: parsed.source,
      spentAt: parsed.spentAt,
    }),
    emailId: `gmail:${messageId}`,
    from: getHeader(message, 'From'),
    messageId: getHeader(message, 'Message-ID'),
    merchant: parsed.merchant,
    occurredAt: parsed.occurredAt,
    provider: 'gmail',
    source: parsed.source,
    spentAt: parsed.spentAt,
    subject: getHeader(message, 'Subject'),
    textSnippet: text.slice(0, 2000),
    to: [ownerEmail],
    userEmail: ownerEmail,
  })

  return {
    saved: true,
    skipped: false,
    source: parsed.source,
    merchant: parsed.merchant,
    amount: parsed.amount,
    currency: parsed.currency,
    spentAt: parsed.spentAt,
  }
}

async function listGmailMessages(
  query: string,
  request?: Request,
  maxMessages = 100,
) {
  const messages: Array<{ id?: string | null }> = []
  let pageToken: string | undefined

  do {
    const url = new URL('users/me/messages', 'https://gmail.googleapis.com/')
    url.searchParams.set(
      'maxResults',
      String(Math.min(100, Math.max(1, maxMessages - messages.length))),
    )
    url.searchParams.set('q', query)
    if (pageToken) {
      url.searchParams.set('pageToken', pageToken)
    }

    const page = await gmailRequest<{
      messages?: Array<{ id?: string | null }>
      nextPageToken?: string
    }>(url.pathname.slice(1) + url.search, request)

    messages.push(...(page.messages ?? []))
    if (messages.length >= maxMessages) {
      break
    }

    pageToken = page.nextPageToken
  } while (pageToken)

  return messages.slice(0, maxMessages)
}

async function syncGmailQuery({
  client,
  ownerEmail,
  query,
  request,
  maxMessages,
}: {
  client: ConvexHttpClient
  ownerEmail: string
  query: string
  request: Request
  maxMessages?: number
}) {
  const messageRefs = await listGmailMessages(query, request, maxMessages)
  let saved = 0
  let skipped = 0

  for (const item of messageRefs) {
    if (!item.id) {
      skipped += 1
      continue
    }

    const result = await saveGmailMessageExpense({
      client,
      message: await getGmailMessage(item.id, request),
      ownerEmail,
    })

    if (result.saved) {
      saved += 1
    } else {
      skipped += 1
    }
  }

  return { matched: messageRefs.length, saved, skipped }
}

function getRecentBankQuery(request?: Request) {
  const days = Number(getRuntimeEnv('GMAIL_POLL_NEWER_THAN_DAYS', request) ?? 3)
  const safeDays = Number.isFinite(days) ? Math.max(1, Math.round(days)) : 3

  return `newer_than:${safeDays}d ${getRuntimeEnv('GMAIL_QUERY', request) ?? DEFAULT_BANK_QUERY}`
}

function getPollMaxMessages(request?: Request) {
  const maxMessages = Number(
    getRuntimeEnv('GMAIL_POLL_MAX_MESSAGES', request) ?? 20,
  )

  return Number.isFinite(maxMessages)
    ? Math.max(1, Math.min(40, Math.round(maxMessages)))
    : 20
}

export async function handleGmailSync(request: Request) {
  try {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204 })
    }

    if (request.method !== 'POST') {
      return jsonResponse(
        { error: 'Method not allowed. Use POST.' },
        { status: 405, headers: { allow: 'POST, OPTIONS' } },
      )
    }

    const secret = getRuntimeEnv('GMAIL_SYNC_SECRET', request)
    if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
      return jsonResponse({ error: 'Unauthorized.' }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >
    const ownerEmail = getOwnerEmail(request)
    if (!ownerEmail) {
      return jsonResponse(
        { error: 'OWNER_EMAIL is not configured.' },
        { status: 501 },
      )
    }

    const query =
      typeof body.query === 'string' && body.query
        ? body.query
        : (getRuntimeEnv('GMAIL_QUERY', request) ?? DEFAULT_BANK_QUERY)
    const client = getConvexClient(request)
    const result = await syncGmailQuery({ client, ownerEmail, query, request })

    return jsonResponse({ ok: true, query, ...result })
  } catch (error) {
    return errorJsonResponse(error)
  }
}

export async function handleGmailPoll(request: Request) {
  try {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204 })
    }

    if (request.method !== 'POST') {
      return jsonResponse(
        { error: 'Method not allowed. Use POST.' },
        { status: 405, headers: { allow: 'POST, OPTIONS' } },
      )
    }

    const secret = getRuntimeEnv('GMAIL_SYNC_SECRET', request)
    if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
      return jsonResponse({ error: 'Unauthorized.' }, { status: 401 })
    }

    const ownerEmail = getOwnerEmail(request)
    if (!ownerEmail) {
      return jsonResponse(
        { error: 'OWNER_EMAIL is not configured.' },
        { status: 501 },
      )
    }

    const client = getConvexClient(request)
    const query = getRecentBankQuery(request)
    const result = await syncGmailQuery({
      client,
      maxMessages: getPollMaxMessages(request),
      ownerEmail,
      query,
      request,
    })

    return jsonResponse({ fallback: true, ok: true, query, ...result })
  } catch (error) {
    return errorJsonResponse(error)
  }
}

export async function handleGmailWatch(request: Request) {
  try {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204 })
    }

    if (request.method !== 'POST') {
      return jsonResponse(
        { error: 'Method not allowed. Use POST.' },
        { status: 405, headers: { allow: 'POST, OPTIONS' } },
      )
    }

    const secret = getRuntimeEnv('GMAIL_SYNC_SECRET', request)
    if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
      return jsonResponse({ error: 'Unauthorized.' }, { status: 401 })
    }

    const ownerEmail = getOwnerEmail(request)
    if (!ownerEmail) {
      return jsonResponse(
        { error: 'OWNER_EMAIL is not configured.' },
        { status: 501 },
      )
    }

    const response = await gmailRequest<{
      historyId?: string
      expiration?: string
    }>('users/me/watch', request, {
      body: JSON.stringify({
        topicName: getRequiredEnv('GMAIL_PUBSUB_TOPIC', request),
      }),
      method: 'POST',
    })

    const client = getConvexClient(request)
    await client.mutation(api.gmailSync.upsertState, {
      historyId: response.historyId,
      userEmail: ownerEmail,
      watchExpiration: response.expiration
        ? Number(response.expiration)
        : undefined,
    })

    return jsonResponse({ ok: true, ...response })
  } catch (error) {
    return errorJsonResponse(error)
  }
}

async function listHistoryMessageIds({
  request,
  startHistoryId,
}: {
  request: Request
  startHistoryId: string
}) {
  const ids = new Set<string>()
  let pageToken: string | undefined

  do {
    const url = new URL('users/me/history', 'https://gmail.googleapis.com/')
    url.searchParams.set('historyTypes', 'messageAdded')
    url.searchParams.set('startHistoryId', startHistoryId)
    if (pageToken) {
      url.searchParams.set('pageToken', pageToken)
    }

    const page = await gmailRequest<{
      history?: GmailHistoryEntry[]
      nextPageToken?: string
    }>(url.pathname.slice(1) + url.search, request)

    for (const entry of page.history ?? []) {
      for (const added of entry.messagesAdded ?? []) {
        if (added.message?.id) {
          ids.add(added.message.id)
        }
      }
    }

    pageToken = page.nextPageToken
  } while (pageToken)

  return [...ids]
}

function decodePubSubData(value: string | undefined) {
  if (!value) {
    return null
  }

  return JSON.parse(decodeBase64Url(value)) as {
    emailAddress?: string
    historyId?: string
  }
}

export async function handleGmailPubSubWebhook(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 })
  }

  if (request.method !== 'POST') {
    return jsonResponse(
      { error: 'Method not allowed. Use POST.' },
      { status: 405, headers: { allow: 'POST, OPTIONS' } },
    )
  }

  const webhookSecret = getRuntimeEnv('GMAIL_PUBSUB_WEBHOOK_SECRET', request)
  if (
    webhookSecret &&
    new URL(request.url).searchParams.get('token') !== webhookSecret
  ) {
    return jsonResponse({ error: 'Unauthorized.' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as PubSubPushBody | null
  const notification = decodePubSubData(body?.message?.data)
  const ownerEmail = getOwnerEmail(request, notification?.emailAddress)

  if (!ownerEmail || !notification?.historyId) {
    return jsonResponse(
      { error: 'Invalid Gmail Pub/Sub notification.' },
      { status: 400 },
    )
  }

  const client = getConvexClient(request)
  const state = await client.query(api.gmailSync.getState, {
    userEmail: ownerEmail,
  })

  if (!state?.historyId) {
    const fallback = await syncGmailQuery({
      client,
      maxMessages: getPollMaxMessages(request),
      ownerEmail,
      query: getRecentBankQuery(request),
      request,
    })

    await client.mutation(api.gmailSync.upsertState, {
      historyId: notification.historyId,
      userEmail: ownerEmail,
    })

    return jsonResponse({
      ok: true,
      initialized: true,
      fallback,
      historyId: notification.historyId,
    })
  }

  let messageIds: string[]
  let fallback:
    | {
        matched: number
        saved: number
        skipped: number
      }
    | undefined

  try {
    messageIds = await listHistoryMessageIds({
      request,
      startHistoryId: state.historyId,
    })
  } catch (error) {
    if (!(error instanceof GmailApiError) || error.status !== 404) {
      throw error
    }

    messageIds = []
    fallback = await syncGmailQuery({
      client,
      maxMessages: getPollMaxMessages(request),
      ownerEmail,
      query: getRecentBankQuery(request),
      request,
    })
  }
  let saved = 0
  let skipped = 0

  for (const messageId of messageIds) {
    const result = await saveGmailMessageExpense({
      client,
      message: await getGmailMessage(messageId, request),
      ownerEmail,
    })

    if (result.saved) {
      saved += 1
    } else {
      skipped += 1
    }
  }

  await client.mutation(api.gmailSync.upsertState, {
    historyId: notification.historyId,
    userEmail: ownerEmail,
  })

  return jsonResponse({
    ok: true,
    historyId: notification.historyId,
    previousHistoryId: state.historyId,
    matched: messageIds.length,
    saved,
    skipped,
    ...(fallback ? { fallback } : {}),
  })
}
