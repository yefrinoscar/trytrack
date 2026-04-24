type ErrorLike = {
  name?: unknown
  message?: unknown
  stack?: unknown
  status?: unknown
  statusText?: unknown
  code?: unknown
  error?: unknown
  cause?: unknown
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function cleanUrl(value: string): string {
  try {
    const url = new URL(value)
    url.username = ''
    url.password = ''
    return url.toString()
  } catch {
    return value
  }
}

export function getErrorStatus(error: unknown): number | undefined {
  if (!isObject(error)) {
    return undefined
  }

  const candidate =
    typeof error.status === 'number'
      ? error.status
      : isObject(error.response) && typeof error.response.status === 'number'
        ? error.response.status
        : isObject(error.error) && typeof error.error.status === 'number'
          ? error.error.status
          : undefined

  return candidate
}

export function isHttpStatus(error: unknown, statuses: number[]): boolean {
  const status = getErrorStatus(error)
  return typeof status === 'number' && statuses.includes(status)
}

export function serializeError(error: unknown, depth = 0): unknown {
  if (depth > 2) {
    return '[MaxDepth]'
  }

  if (!isObject(error)) {
    return error
  }

  const errorLike = error as ErrorLike
  const serialized: Record<string, unknown> = {}

  for (const key of [
    'name',
    'message',
    'status',
    'statusText',
    'code',
    'stack',
  ] as const) {
    const value = errorLike[key]
    if (typeof value === 'string' || typeof value === 'number') {
      serialized[key] = value
    }
  }

  if (isObject(errorLike.error)) {
    serialized.error = serializeError(errorLike.error, depth + 1)
  }
  if (isObject(errorLike.cause)) {
    serialized.cause = serializeError(errorLike.cause, depth + 1)
  }
  if (isObject(error.response)) {
    serialized.response = {
      status:
        typeof error.response.status === 'number'
          ? error.response.status
          : undefined,
      statusText:
        typeof error.response.statusText === 'string'
          ? error.response.statusText
          : undefined,
      url:
        typeof error.response.url === 'string'
          ? cleanUrl(error.response.url)
          : undefined,
    }
  }

  return serialized
}

export function logServerError(
  message: string,
  error: unknown,
  context: Record<string, unknown> = {},
) {
  console.error(
    JSON.stringify({
      level: 'error',
      message,
      context,
      error: serializeError(error),
    }),
  )
}
