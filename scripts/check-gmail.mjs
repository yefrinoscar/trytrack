#!/usr/bin/env node
/**
 * Diagnoses the Gmail expense import without touching the database.
 *
 * Uses the same credentials path as production (Worker secrets pulled via
 * `wrangler secret` is not readable, so pass them as env vars instead):
 *
 *   GMAIL_CLIENT_ID=... GMAIL_CLIENT_SECRET=... GMAIL_REFRESH_TOKEN=... \
 *     node scripts/check-gmail.mjs [--days 3] [--max 10]
 *
 * It refreshes the access token, then lists messages matching the same query
 * the cron uses, parsing each one to show what would be imported.
 */
import process from 'node:process'

const args = process.argv.slice(2)
function argValue(name, fallback) {
  const i = args.indexOf(`--${name}`)
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback
}

const days = Number(argValue('days', '3'))
const max = Number(argValue('max', '10'))
const owner = process.env.OWNER_EMAIL

const clientId = process.env.GMAIL_CLIENT_ID
const clientSecret = process.env.GMAIL_CLIENT_SECRET
const refreshToken = process.env.GMAIL_REFRESH_TOKEN

const missing = Object.entries({ clientId, clientSecret, refreshToken })
  .filter(([, v]) => !v)
  .map(([k]) => k)

if (missing.length) {
  console.error(
    `Missing credentials: ${missing.join(', ')}\n` +
      'Pass them as env vars (see the header of this file).',
  )
  process.exit(1)
}

const DEFAULT_BANK_QUERY =
  '(from:notificaciones@yape.pe OR from:procesos@bbva.com.pe OR from:yape@bcp.com.pe OR from:notificaciones@notificacionesbcp.com.pe OR yape OR bbva OR plin)'

const query = `newer_than:${Math.max(1, Math.round(days))}d ${DEFAULT_BANK_QUERY}`

console.log('1) Refrescando access token…')
const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  }),
})

const tokenBody = await tokenRes.json().catch(() => ({}))
if (!tokenRes.ok || !tokenBody.access_token) {
  console.error(`   ✗ FALLÓ (${tokenRes.status})`)
  console.error('   ', JSON.stringify(tokenBody))
  console.error(
    '\n   Si dice "invalid_grant", el refresh token caducó o fue revocado.' +
      '\n   Hay que volver a autorizar la app de Google y subir GMAIL_REFRESH_TOKEN.',
  )
  process.exit(1)
}
console.log('   ✓ token OK')
const accessToken = tokenBody.access_token

const auth = { Authorization: `Bearer ${accessToken}` }

console.log(`2) Perfil de la cuenta…`)
const profileRes = await fetch(
  'https://gmail.googleapis.com/gmail/v1/users/me/profile',
  { headers: auth },
)
const profile = await profileRes.json().catch(() => ({}))
if (!profileRes.ok) {
  console.error(`   ✗ FALLÓ (${profileRes.status})`, JSON.stringify(profile))
  process.exit(1)
}
console.log(`   cuenta: ${profile.emailAddress}`)
if (owner && owner.toLowerCase() !== profile.emailAddress?.toLowerCase()) {
  console.log(
    `   ⚠ OWNER_EMAIL="${owner}" no coincide con la cuenta autorizada.`,
  )
}

console.log(`3) Buscando correos…`)
console.log(`   query: ${query}`)
const listRes = await fetch(
  `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${max}&q=${encodeURIComponent(query)}`,
  { headers: auth },
)
const list = await listRes.json().catch(() => ({}))
if (!listRes.ok) {
  console.error(`   ✗ FALLÓ (${listRes.status})`, JSON.stringify(list))
  process.exit(1)
}

const messages = list.messages ?? []
console.log(`   encontrados: ${messages.length}`)
if (!messages.length) {
  console.log(
    '\n   No hay correos que coincidan. Revisa que los remitentes estén en la' +
      '\n   lista de bancos y que el rango de días cubra tus gastos.',
  )
  process.exit(0)
}

console.log('4) Cabeceras (From / Subject / Date)…')
for (const item of messages) {
  const msgRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
    { headers: auth },
  )
  const msg = await msgRes.json().catch(() => ({}))
  const headers = Object.fromEntries(
    (msg.payload?.headers ?? []).map((h) => [h.name, h.value]),
  )
  console.log(
    `   - ${headers.Date ?? '?'} | ${headers.From ?? '?'} | ${headers.Subject ?? '(sin asunto)'}`,
  )
}

console.log('\nSi aquí aparecen correos pero la app no muestra gastos,')
console.log('el problema está en el parseo o en el guardado, no en Gmail.')
