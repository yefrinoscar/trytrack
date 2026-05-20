import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import process from 'node:process'
import { ConvexHttpClient } from 'convex/browser'
import { google } from 'googleapis'
import { api } from '../convex/_generated/api.js'
import { parseEmailExpense } from '../src/lib/email-expense-parser.ts'

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']
const CREDENTIALS_PATH =
  process.env.GMAIL_CREDENTIALS_PATH ?? 'secrets/gmail-oauth-client.json'
const TOKEN_PATH = process.env.GMAIL_TOKEN_PATH ?? 'secrets/gmail-token.json'
const DEFAULT_QUERY =
  'after:2026/5/1 before:2026/6/1 (from:notificaciones@yape.pe OR from:procesos@bbva.com.pe OR yape OR bbva OR plin)'
const DEFAULT_SPENT_AT_START = '2026-05-01'
const DEFAULT_SPENT_AT_END = '2026-06-01'

function loadEnvFile(path) {
  if (!existsSync(path)) {
    return
  }

  const content = readFileSync(path, 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) {
      continue
    }

    const [, key, rawValue] = match
    if (process.env[key]) {
      continue
    }

    process.env[key] = rawValue
      .trim()
      .replace(/^['"]|['"]$/g, '')
      .replace(/\s+#.*$/, '')
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

function openUrl(url) {
  const command =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
        ? 'cmd'
        : 'xdg-open'
  const args = process.platform === 'win32' ? ['/c', 'start', '""', url] : [url]

  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
  })
  child.unref()
}

async function getOAuthClient() {
  const credentials = await readJson(CREDENTIALS_PATH)
  const config = credentials.installed ?? credentials.web
  if (!config) {
    throw new Error(
      `Expected ${CREDENTIALS_PATH} to contain an installed or web OAuth client.`,
    )
  }

  const redirectUri = 'http://localhost:45873'
  const client = new google.auth.OAuth2(
    config.client_id,
    config.client_secret,
    redirectUri,
  )

  if (existsSync(TOKEN_PATH)) {
    client.setCredentials(await readJson(TOKEN_PATH))
    return client
  }

  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  })

  console.log('Opening Google authorization URL...')
  console.log(authUrl)
  openUrl(authUrl)

  const code = await waitForOAuthCode()
  const { tokens } = await client.getToken(code)
  client.setCredentials(tokens)
  await writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2))

  return client
}

async function waitForOAuthCode() {
  return await new Promise((resolve, reject) => {
    const server = createServer((request, response) => {
      try {
        const url = new URL(request.url ?? '/', 'http://localhost:45873')
        const code = url.searchParams.get('code')
        const error = url.searchParams.get('error')

        if (error) {
          response.writeHead(400, { 'content-type': 'text/plain' })
          response.end(`OAuth failed: ${error}`)
          reject(new Error(`OAuth failed: ${error}`))
          server.close()
          return
        }

        if (!code) {
          response.writeHead(404, { 'content-type': 'text/plain' })
          response.end('Missing OAuth code.')
          return
        }

        response.writeHead(200, { 'content-type': 'text/plain' })
        response.end(
          'TryTrack Gmail import is authorized. You can close this tab.',
        )
        resolve(code)
        server.close()
      } catch (error) {
        reject(error)
        server.close()
      }
    })

    server.listen(45873, 'localhost')
  })
}

function decodeBase64Url(value) {
  return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
    .toString('utf8')
    .replace(/\r/g, '')
}

function collectParts(part, texts = { html: [], plain: [] }) {
  if (!part) {
    return texts
  }

  const bodyData = part.body?.data
  if (bodyData && part.mimeType === 'text/plain') {
    texts.plain.push(decodeBase64Url(bodyData))
  }
  if (bodyData && part.mimeType === 'text/html') {
    texts.html.push(decodeBase64Url(bodyData))
  }

  for (const child of part.parts ?? []) {
    collectParts(child, texts)
  }

  return texts
}

function htmlToText(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function getHeader(message, name) {
  return message.payload?.headers?.find(
    (header) => header.name?.toLowerCase() === name.toLowerCase(),
  )?.value
}

function createEmailExpenseDedupeKey({
  amount,
  currency,
  merchant,
  ownerEmail,
  source,
  spentAt,
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

async function listMessages(gmail, query) {
  const messages = []
  let pageToken

  do {
    const response = await gmail.users.messages.list({
      maxResults: 100,
      pageToken,
      q: query,
      userId: 'me',
    })
    messages.push(...(response.data.messages ?? []))
    pageToken = response.data.nextPageToken
  } while (pageToken)

  return messages
}

async function main() {
  loadEnvFile('.env.local')
  loadEnvFile('.env')

  const convexUrl = process.env.VITE_CONVEX_URL ?? process.env.CONVEX_URL
  if (!convexUrl) {
    throw new Error('Set VITE_CONVEX_URL or CONVEX_URL in .env/.env.local.')
  }

  const auth = await getOAuthClient()
  const gmail = google.gmail({ auth, version: 'v1' })
  const profile = await gmail.users.getProfile({ userId: 'me' })
  const ownerEmail =
    process.env.OWNER_EMAIL ?? profile.data.emailAddress?.toLowerCase()

  if (!ownerEmail) {
    throw new Error(
      'Set OWNER_EMAIL or authorize a Gmail account with an email.',
    )
  }

  const query = process.env.GMAIL_QUERY ?? DEFAULT_QUERY
  const spentAtStart = process.env.SPENT_AT_START ?? DEFAULT_SPENT_AT_START
  const spentAtEnd = process.env.SPENT_AT_END ?? DEFAULT_SPENT_AT_END
  console.log(`Gmail query: ${query}`)
  console.log(`Owner email: ${ownerEmail}`)
  console.log(`Spent-at range: ${spentAtStart} to ${spentAtEnd}`)

  const client = new ConvexHttpClient(convexUrl)
  const messages = await listMessages(gmail, query)
  let parsedCount = 0
  let savedCount = 0
  let skippedCount = 0

  for (const item of messages) {
    const response = await gmail.users.messages.get({
      format: 'full',
      id: item.id,
      userId: 'me',
    })
    const message = response.data
    const parts = collectParts(message.payload)
    const text = parts.plain.join('\n\n') || htmlToText(parts.html.join('\n\n'))
    const parsed = parseEmailExpense({
      from: getHeader(message, 'From'),
      text,
    })

    if (parsed.ignore) {
      skippedCount += 1
      console.log(
        `Skipped ${item.id}: ${getHeader(message, 'Subject') ?? '(no subject)'} - ${parsed.error ?? 'ignored'}`,
      )
      continue
    }

    if (!parsed.amount || !parsed.currency || !parsed.spentAt) {
      skippedCount += 1
      console.log(
        `Skipped ${item.id}: ${getHeader(message, 'Subject') ?? '(no subject)'} - ${parsed.error ?? 'not parsed'}`,
      )
      continue
    }

    if (parsed.spentAt < spentAtStart || parsed.spentAt >= spentAtEnd) {
      skippedCount += 1
      console.log(
        `Skipped ${item.id}: spentAt ${parsed.spentAt} outside ${spentAtStart}..${spentAtEnd}`,
      )
      continue
    }

    parsedCount += 1
    const dedupeKey = createEmailExpenseDedupeKey({
      amount: parsed.amount,
      currency: parsed.currency,
      merchant: parsed.merchant,
      ownerEmail,
      source: parsed.source,
      spentAt: parsed.spentAt,
    })
    await client.mutation(api.expenses.importFromEmail, {
      amount: parsed.amount,
      currency: parsed.currency,
      dedupeKey,
      emailId: `gmail:${item.id}`,
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
    savedCount += 1
    console.log(
      `Saved ${parsed.source}: ${parsed.merchant ?? '(no merchant)'} ${parsed.currency} ${parsed.amount} ${parsed.spentAt}`,
    )
  }

  console.log(
    JSON.stringify(
      {
        matched: messages.length,
        parsed: parsedCount,
        saved: savedCount,
        skipped: skippedCount,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
