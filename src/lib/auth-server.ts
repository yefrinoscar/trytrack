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

async function responseDebugBody(response: Response) {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('json') && !contentType.includes('text')) {
    return {
      skipped: true,
      contentType,
    }
  }

  try {
    const text = await response.clone().text()
    return text.slice(0, 2_000)
  } catch (error) {
    return {
      readFailed: serializeError(error),
    }
  }
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

function requestContext(request: Request, requestId = crypto.randomUUID()) {
  const requestUrl = new URL(request.url)
  const convexSiteUrl = getConvexSiteUrl()
  const upstreamUrl = new URL(
    `${convexSiteUrl}${requestUrl.pathname}${requestUrl.search}`,
  )

  return {
    requestId,
    method: request.method,
    url: request.url,
    path: requestUrl.pathname,
    host: requestUrl.host,
    origin: request.headers.get('origin'),
    referer: request.headers.get('referer'),
    forwardedHost: request.headers.get('x-forwarded-host'),
    forwardedProto: request.headers.get('x-forwarded-proto'),
    convexUrl: import.meta.env.VITE_CONVEX_URL || null,
    convexSiteUrl: import.meta.env.VITE_CONVEX_SITE_URL || null,
    siteUrl: import.meta.env.VITE_SITE_URL || null,
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
  console.info(
    JSON.stringify({
      level: 'info',
      message: 'Auth proxy request started',
      context,
    }),
  )

  try {
    assertConvexSiteUrlDoesNotPointAtApp({
      host: context.host,
      convexSiteHost: context.convexSiteHost,
      source: 'auth-handler',
    })

    const response = await getHelpers().handler(request)
    if (response.status >= 400) {
      logServerError('Auth proxy returned an upstream error', null, {
        ...context,
        status: response.status,
        statusText: response.statusText,
        responseBody: await responseDebugBody(response),
      })
    } else {
      console.info(
        JSON.stringify({
          level: 'info',
          message: 'Auth proxy request succeeded',
          context: {
            requestId: context.requestId,
            status: response.status,
            statusText: response.statusText,
          },
        }),
      )
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
        context,
        error: serializeError(error),
        likelyCauses: [
          'VITE_CONVEX_SITE_URL is missing, points to .convex.cloud, or points to the app host instead of the .convex.site HTTP Actions URL.',
          'The Convex Better Auth HTTP action returned an upstream error.',
          'SITE_URL/TRUSTED_ORIGINS in Convex do not include the exact app origin.',
        ],
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
      convexUrl: import.meta.env.VITE_CONVEX_URL || null,
      convexSiteUrl: import.meta.env.VITE_CONVEX_SITE_URL || null,
      siteUrl: import.meta.env.VITE_SITE_URL || null,
    })
    throw error
  }
}
