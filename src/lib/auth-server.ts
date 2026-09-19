import { getAuth } from '#/server/auth'
import {
  getCloudflareRequestInfo,
  logError,
  logInfo,
} from '#/lib/server-logger'
import { serializeError } from '#/lib/server-error'

/**
 * Better Auth handler mounted at `/api/auth/*`. Runs in the Worker itself
 * (D1-backed) instead of proxying to a Convex HTTP action.
 */
export async function handler(request: Request) {
  const cf = getCloudflareRequestInfo(request)
  const start = performance.now()

  logInfo({
    event: 'auth.request_started',
    message: 'Auth request started',
    cf,
  })

  try {
    const auth = await getAuth()
    const response = await auth.handler(request)
    const durationMs = performance.now() - start

    if (response.status >= 500) {
      logError({
        event: 'auth.request_5xx',
        message: 'Auth request returned a server error',
        cf,
        context: { status: response.status, statusText: response.statusText },
        durationMs,
      })
    } else {
      logInfo({
        event: 'auth.request_finished',
        message: 'Auth request finished',
        cf,
        context: { status: response.status },
        durationMs,
      })
    }

    return response
  } catch (error) {
    const errorId = crypto.randomUUID()
    logError({
      event: 'auth.request_failed',
      message: 'Auth request failed',
      cf,
      error,
      context: { errorId },
      durationMs: performance.now() - start,
    })
    return Response.json(
      {
        status: 500,
        unhandled: true,
        message: 'Auth request failed',
        errorId,
        error: serializeError(error),
      },
      { status: 500 },
    )
  }
}
