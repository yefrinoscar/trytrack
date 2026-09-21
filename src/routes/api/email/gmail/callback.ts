import { createFileRoute } from '@tanstack/react-router'
import { getSession } from '#/server/auth'
import {
  exchangeGmailCode,
  fetchGmailAccountEmail,
  refreshGmailAccessToken,
  upsertGmailConnection,
} from '#/server/api/gmailOAuth'
import { consumeOAuthState } from '#/server/api/oauthState'
import { getSiteUrl } from '#/server/env'
import { logError, logInfo } from '#/lib/server-logger'

/**
 * Google redirects here after the user approves access. Validates the state,
 * exchanges the code for a refresh token and stores the connection.
 */
export async function handleGmailCallback(request: Request) {
  const url = new URL(request.url)
  const settings = new URL('/settings', getSiteUrl())

  const fail = (reason: string) => {
    settings.searchParams.set('gmail', reason)
    return Response.redirect(settings.toString(), 302)
  }

  const error = url.searchParams.get('error')
  if (error) {
    logInfo({
      event: 'gmail.oauth.denied',
      message: 'User denied Gmail access',
      context: { error },
    })
    return fail('denied')
  }

  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state') ?? ''
  if (!code) {
    return fail('missing_code')
  }

  const stateUserId = await consumeOAuthState(state)
  if (!stateUserId) {
    logError({
      event: 'gmail.oauth.bad_state',
      message: 'Gmail OAuth state was invalid, expired or already used',
    })
    return fail('invalid_state')
  }

  // The browser must still be signed in as the account that started the flow.
  const session = await getSession()
  if (!session?.user) {
    return Response.redirect(new URL('/login', getSiteUrl()).toString(), 302)
  }

  try {
    const tokens = await exchangeGmailCode(code)
    const access = await refreshGmailAccessToken(tokens.refreshToken)
    const email = await fetchGmailAccountEmail(access.accessToken)

    if (!email) {
      logError({
        event: 'gmail.oauth.no_email',
        message: 'Could not read the Google account email after consent',
      })
      return fail('no_email')
    }

    await upsertGmailConnection({
      userId: stateUserId,
      email,
      refreshToken: tokens.refreshToken,
      scope: tokens.scope,
    })

    logInfo({
      event: 'gmail.oauth.connected',
      message: 'Gmail account connected',
      context: { email },
    })

    settings.searchParams.set('gmail', 'connected')
    return Response.redirect(settings.toString(), 302)
  } catch (err) {
    logError({
      event: 'gmail.oauth.failed',
      message: 'Gmail OAuth callback failed',
      error: err,
    })
    return fail('failed')
  }
}

export const Route = createFileRoute('/api/email/gmail/callback')({
  server: {
    handlers: {
      GET: ({ request }) => handleGmailCallback(request),
    },
  },
})
