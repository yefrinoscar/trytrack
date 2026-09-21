import { definePlugin } from 'nitro'
import { handleGmailPoll, handleGmailWatch } from './gmail-expense-sync'

type CloudflareEnv = Record<string, unknown>

type RuntimeRequest = Request & {
  runtime?: {
    cloudflare?: {
      env?: CloudflareEnv
    }
  }
}

const WATCH_RENEWAL_CRON = '0 */12 * * *'

function getEnvString(env: CloudflareEnv, name: string) {
  const value = env[name]

  return typeof value === 'string' ? value : undefined
}

function createScheduledGmailRequest(path: string, env: CloudflareEnv) {
  const origin =
    getEnvString(env, 'PUBLIC_APP_URL') ??
    getEnvString(env, 'APP_URL') ??
    'https://trytrack.underlabs.dev'
  const secret = getEnvString(env, 'GMAIL_SYNC_SECRET')
  const headers = new Headers()

  if (secret) {
    headers.set('authorization', `Bearer ${secret}`)
  }

  const request = new Request(new URL(path, origin), {
    headers,
    method: 'POST',
  }) as RuntimeRequest
  request.runtime = {
    cloudflare: {
      env,
    },
  }

  return request
}

async function logScheduledResponse(label: string, response: Response) {
  const body = await response.text().catch(() => '')

  if (!response.ok) {
    console.error(
      JSON.stringify({
        level: 'error',
        event: `gmail.scheduled.${label}_failed`,
        status: response.status,
        body: body.slice(0, 1000),
      }),
    )
    return
  }

  // A 200 can still mean "the sync could not run" (for example the Gmail
  // refresh token expired). Surface it so failures are not silent.
  let parsed: { ok?: boolean; error?: string; saved?: number } | null = null
  try {
    parsed = JSON.parse(body)
  } catch {
    parsed = null
  }

  if (parsed?.error) {
    console.error(
      JSON.stringify({
        level: 'error',
        event: `gmail.scheduled.${label}_error`,
        error: parsed.error,
      }),
    )
    return
  }

  console.log(
    JSON.stringify({
      level: 'info',
      event: `gmail.scheduled.${label}_ok`,
      saved: parsed?.saved ?? null,
    }),
  )
}

export default definePlugin((nitroApp) => {
  nitroApp.hooks.hook('cloudflare:scheduled', async ({ controller, env }) => {
    const cloudflareEnv = (env ?? {}) as CloudflareEnv

    if (getEnvString(cloudflareEnv, 'GMAIL_AUTO_SYNC_DISABLED') === 'true') {
      return
    }

    const cron =
      typeof controller.cron === 'string' ? controller.cron : undefined

    if (cron === WATCH_RENEWAL_CRON) {
      await logScheduledResponse(
        'watch renewal',
        await handleGmailWatch(
          createScheduledGmailRequest('/api/email/gmail/watch', cloudflareEnv),
        ),
      )
    }

    await logScheduledResponse(
      'poll',
      await handleGmailPoll(
        createScheduledGmailRequest('/api/email/gmail/poll', cloudflareEnv),
      ),
    )
  })
})
