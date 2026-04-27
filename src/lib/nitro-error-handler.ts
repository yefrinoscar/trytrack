import { serializeError } from './server-error'
import {
  getCloudflareRequestInfo,
  logError,
  type CloudflareRequestInfo,
} from './server-logger'

function getRequestFromEvent(event: unknown): Request | null {
  if (!event || typeof event !== 'object') {
    return null
  }
  const record = event as Record<string, unknown>
  if (record.request instanceof Request) {
    return record.request
  }
  const node = record.node
  if (node && typeof node === 'object') {
    const req = (node as Record<string, unknown>).req
    if (req instanceof Request) {
      return req
    }
  }
  return null
}

function getStatusFromEvent(event: unknown): number | undefined {
  if (!event || typeof event !== 'object') {
    return undefined
  }
  const record = event as Record<string, unknown>
  const node = record.node
  if (node && typeof node === 'object') {
    const res = (node as Record<string, unknown>).res
    if (res && typeof res === 'object') {
      const status = (res as Record<string, unknown>).statusCode
      if (typeof status === 'number') {
        return status
      }
    }
  }
  return undefined
}

function getErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') {
    return undefined
  }
  const e = error as Record<string, unknown>
  if (typeof e.statusCode === 'number') {
    return e.statusCode
  }
  if (typeof e.status === 'number') {
    return e.status
  }
  return undefined
}

export default async function nitroErrorHandler(
  error: unknown,
  event: unknown,
) {
  const errorId = crypto.randomUUID()
  const request = getRequestFromEvent(event)
  const cf: CloudflareRequestInfo = getCloudflareRequestInfo(request, errorId)

  const status = getErrorStatus(error) ?? getStatusFromEvent(event) ?? 500

  logError({
    event: 'nitro.unhandled_error',
    message: 'Unhandled Nitro error',
    cf,
    error,
    context: {
      errorId,
      status,
      hint: 'Search Cloudflare logs by errorId or cf.cfRay to find related entries.',
    },
  })

  return Response.json(
    {
      status,
      unhandled: true,
      message: 'Unhandled Nitro error',
      errorId,
      cfRay: cf.cfRay,
      request: {
        method: cf.method,
        path: cf.path,
        host: cf.host,
        url: cf.url,
      },
      error: serializeError(error),
      hint: 'Search Cloudflare logs for this errorId. This response is intentionally verbose so deployment/runtime failures are diagnosable.',
    },
    { status },
  )
}
