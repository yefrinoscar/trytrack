import { convexBetterAuthReactStart } from '@convex-dev/better-auth/react-start'
import {
  getRequiredConvexSiteUrl,
  getRequiredConvexUrl,
} from '#/lib/convex-public-env'
import {
  isHttpStatus,
  logServerError,
  serializeError,
} from '#/lib/server-error'

type AuthServerHelpers = ReturnType<typeof convexBetterAuthReactStart>

let helpers: AuthServerHelpers | undefined

function getConvexSiteUrl(): string {
  return getRequiredConvexSiteUrl()
}

function getHelpers(): AuthServerHelpers {
  if (!helpers) {
    const convexSiteUrl = getConvexSiteUrl()
    helpers = convexBetterAuthReactStart({
      convexUrl: getRequiredConvexUrl(),
      convexSiteUrl,
    })
  }
  return helpers
}

function requestContext(request: Request) {
  const requestUrl = new URL(request.url)
  const convexSiteUrl = getConvexSiteUrl()
  const upstreamUrl = new URL(
    `${convexSiteUrl}${requestUrl.pathname}${requestUrl.search}`,
  )

  return {
    method: request.method,
    path: requestUrl.pathname,
    host: requestUrl.host,
    convexSiteHost: upstreamUrl.host,
    upstreamPath: upstreamUrl.pathname,
    sameHost: requestUrl.host === upstreamUrl.host,
  }
}

function assertConvexSiteUrlDoesNotPointAtApp(context: {
  host?: string | null
  convexSiteHost: string
  source: string
}) {
  if (!context.host || context.host !== context.convexSiteHost) {
    return
  }

  throw new Error(
    [
      'VITE_CONVEX_SITE_URL points at the app host.',
      'Set it to the Convex HTTP Actions URL, for example https://<deployment>.convex.site.',
      `Current host: ${context.host}.`,
      `Detected in ${context.source}.`,
    ].join(' '),
  )
}

export async function handler(request: Request) {
  const context = requestContext(request)

  try {
    assertConvexSiteUrlDoesNotPointAtApp({
      host: context.host,
      convexSiteHost: context.convexSiteHost,
      source: 'auth-handler',
    })

    const response = await getHelpers().handler(request)
    if (response.status >= 500) {
      logServerError('Auth proxy returned an upstream server error', null, {
        ...context,
        status: response.status,
        statusText: response.statusText,
      })
    }
    return response
  } catch (error) {
    const errorId = crypto.randomUUID()
    logServerError('Auth proxy failed', error, { ...context, errorId })
    return Response.json(
      {
        status: 500,
        unhandled: true,
        message: 'Auth proxy failed',
        errorId,
        ...(import.meta.env.DEV ? { error: serializeError(error) } : {}),
      },
      { status: 500 },
    )
  }
}

export async function getToken() {
  try {
    const convexSiteHost = new URL(getConvexSiteUrl()).host
    const { getRequestHeaders } = await import('@tanstack/react-start/server')
    const host = getRequestHeaders().get('host')

    assertConvexSiteUrlDoesNotPointAtApp({
      host,
      convexSiteHost,
      source: 'get-token',
    })

    return await getHelpers().getToken()
  } catch (error) {
    if (isHttpStatus(error, [401])) {
      return undefined
    }

    const errorId = crypto.randomUUID()
    logServerError('Auth token lookup failed', error, {
      convexSiteHost: new URL(getConvexSiteUrl()).host,
      errorId,
    })
    throw error
  }
}
