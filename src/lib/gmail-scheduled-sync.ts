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
  if (response.ok) {
    return
  }

  const body = await response.text().catch(() => '')
  console.error(`Gmail scheduled ${label} failed`, {
    body: body.slice(0, 500),
    status: response.status,
  })
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
