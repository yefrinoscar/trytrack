import { createFileRoute } from '@tanstack/react-router'
import { getSession } from '#/server/auth'
import { buildGmailAuthUrl, isGmailConfigured } from '#/server/api/gmailOAuth'
import { createOAuthState } from '#/server/api/oauthState'
import { resolveSessionUser } from '#/server/api/users'

/**
 * Starts the "Connect Gmail" flow: redirects the signed-in user to Google's
 * consent screen with a single-use state value tied to their account.
 */
export async function startGmailConnect(request: Request) {
  const session = await getSession()
  if (!session?.user) {
    return Response.redirect(new URL('/login', request.url), 302)
  }

  if (!isGmailConfigured()) {
    return Response.redirect(
      new URL('/settings?gmail=not_configured', request.url),
      302,
    )
  }

  // The app profile row is the stable owner key used by the sync job.
  const appUser = await resolveSessionUser()
  if (!appUser) {
    return Response.redirect(
      new URL('/settings?gmail=no_profile', request.url),
      302,
    )
  }

  const state = await createOAuthState(appUser.id)
  return Response.redirect(buildGmailAuthUrl(state), 302)
}

export const Route = createFileRoute('/api/email/gmail/connect')({
  server: {
    handlers: {
      GET: ({ request }) => startGmailConnect(request),
    },
  },
})
