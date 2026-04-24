import { serializeError } from './server-error'

function getRequestContext(event: unknown): Record<string, unknown> {
  if (!event || typeof event !== 'object') {
    return {}
  }

  const record = event as Record<string, unknown>
  const request =
    record.request instanceof Request
      ? record.request
      : record.node && typeof record.node === 'object'
        ? (record.node as Record<string, unknown>).req
        : undefined

  if (request instanceof Request) {
    const url = new URL(request.url)
    return {
      method: request.method,
      path: url.pathname,
      host: url.host,
      url: url.toString(),
    }
  }

  return {}
}

export default async function nitroErrorHandler(
  error: unknown,
  event: unknown,
) {
  const errorId = crypto.randomUUID()
  const request = getRequestContext(event)
  const serializedError = serializeError(error)

  console.error(
    JSON.stringify({
      level: 'error',
      message: 'Unhandled Nitro error',
      errorId,
      request,
      error: serializedError,
    }),
  )

  return Response.json(
    {
      status: 500,
      unhandled: true,
      message: 'Unhandled Nitro error',
      errorId,
      request,
      error: serializedError,
      hint: 'Search Cloudflare logs for this errorId. This response is intentionally verbose so deployment/runtime failures are diagnosable.',
    },
    { status: 500 },
  )
}
