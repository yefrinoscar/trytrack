import { convexBetterAuthReactStart } from '@convex-dev/better-auth/react-start'
import {
  getRequiredConvexSiteUrl,
  getRequiredConvexUrl,
} from '#/lib/convex-public-env'
import { isHttpStatus, serializeError } from '#/lib/server-error'
import {
  getCloudflareRequestInfo,
  logError,
  logInfo,
  logWarn,
  type CloudflareRequestInfo,
} from '#/lib/server-logger'

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

interface AuthRequestContext {
  cf: CloudflareRequestInfo
  upstream: {
    convexSiteHost: string
    upstreamPath: string
    sameHost: boolean
  }
  env: {
    convexUrl: string | null
    convexSiteUrl: string | null
    siteUrl: string | null
  }
}

function buildAuthRequestContext(request: Request): AuthRequestContext {
  const cf = getCloudflareRequestInfo(request)
  const requestUrl = new URL(request.url)
  const convexSiteUrl = getConvexSiteUrl()
  const upstreamUrl = new URL(
    `${convexSiteUrl}${requestUrl.pathname}${requestUrl.search}`,
  )

  return {
    cf,
    upstream: {
      convexSiteHost: upstreamUrl.host,
      upstreamPath: upstreamUrl.pathname,
      sameHost: requestUrl.host === upstreamUrl.host,
    },
    env: {
      convexUrl: import.meta.env.VITE_CONVEX_URL || null,
      convexSiteUrl: import.meta.env.VITE_CONVEX_SITE_URL || null,
      siteUrl: import.meta.env.VITE_SITE_URL || null,
    },
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
  const ctx = buildAuthRequestContext(request)
  const start = performance.now()

  logInfo({
    event: 'auth.proxy.request_started',
    message: 'Auth proxy request started',
    cf: ctx.cf,
    context: {
      upstream: ctx.upstream,
      env: ctx.env,
    },
  })

  try {
    assertConvexSiteUrlDoesNotPointAtApp({
      host: ctx.cf.host,
      convexSiteHost: ctx.upstream.convexSiteHost,
      source: 'auth-handler',
    })

    const response = await getHelpers().handler(request)
    const durationMs = performance.now() - start

    if (response.status >= 500) {
      logError({
        event: 'auth.proxy.upstream_5xx',
        message: 'Auth proxy returned an upstream error',
        cf: ctx.cf,
        context: {
          status: response.status,
          statusText: response.statusText,
          upstream: ctx.upstream,
          env: ctx.env,
          responseBody: await responseDebugBody(response),
        },
        durationMs,
      })
    } else if (response.status >= 400) {
      logWarn({
        event: 'auth.proxy.upstream_4xx',
        message: 'Auth proxy returned a client error',
        cf: ctx.cf,
        context: {
          status: response.status,
          statusText: response.statusText,
          upstream: ctx.upstream,
          responseBody: await responseDebugBody(response),
        },
        durationMs,
      })
    } else {
      logInfo({
        event: 'auth.proxy.request_succeeded',
        message: 'Auth proxy request succeeded',
        cf: ctx.cf,
        context: {
          status: response.status,
          statusText: response.statusText,
        },
        durationMs,
      })
    }
    return response
  } catch (error) {
    const errorId = crypto.randomUUID()
    const durationMs = performance.now() - start
    logError({
      event: 'auth.proxy.failed',
      message: 'Auth proxy failed',
      cf: ctx.cf,
      error,
      context: {
        errorId,
        upstream: ctx.upstream,
        env: ctx.env,
      },
      durationMs,
    })
    return Response.json(
      {
        status: 500,
        unhandled: true,
        message: 'Auth proxy failed',
        errorId,
        cfRay: ctx.cf.cfRay,
        request: {
          method: ctx.cf.method,
          path: ctx.cf.path,
          host: ctx.cf.host,
          url: ctx.cf.url,
        },
        upstream: ctx.upstream,
        env: ctx.env,
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
  const start = performance.now()
  let host: string | null = null
  let convexSiteHost = ''
  try {
    convexSiteHost = new URL(getConvexSiteUrl()).host
    const { getRequestHeaders } = await import('@tanstack/react-start/server')
    host = getRequestHeaders().get('host')

    assertConvexSiteUrlDoesNotPointAtApp({
      host,
      convexSiteHost,
      source: 'get-token',
    })

    const token = await getHelpers().getToken()
    logInfo({
      event: 'auth.token.lookup_succeeded',
      message: 'Auth token lookup succeeded',
      context: {
        hasToken: Boolean(token),
        host,
        convexSiteHost,
      },
      durationMs: performance.now() - start,
    })
    return token
  } catch (error) {
    if (isHttpStatus(error, [401])) {
      logInfo({
        event: 'auth.token.unauthenticated',
        message: 'Auth token lookup returned 401 (no session)',
        context: {
          host,
          convexSiteHost,
        },
        durationMs: performance.now() - start,
      })
      return undefined
    }

    const errorId = crypto.randomUUID()
    logError({
      event: 'auth.token.lookup_failed',
      message: 'Auth token lookup failed',
      error,
      context: {
        errorId,
        host,
        convexSiteHost,
        env: {
          convexUrl: import.meta.env.VITE_CONVEX_URL || null,
          convexSiteUrl: import.meta.env.VITE_CONVEX_SITE_URL || null,
          siteUrl: import.meta.env.VITE_SITE_URL || null,
        },
      },
      durationMs: performance.now() - start,
    })
    throw error
  }
}
