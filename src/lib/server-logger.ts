import { serializeError } from './server-error'

/**
 * Structured server-side logger optimized for Cloudflare Workers Observability.
 *
 * Cloudflare's Logs platform indexes single-line JSON written to console.* and
 * lets you filter by any top-level field. Every entry from this logger ships
 * with a stable shape (level, time, event, message, error) plus the request
 * context (cf-ray, geo, host) so dashboards and alerts can group failures
 * without parsing free-form strings.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export type LogContext = Record<string, unknown>

export interface CloudflareRequestInfo {
  requestId: string
  method?: string | null
  path?: string | null
  host?: string | null
  origin?: string | null
  referer?: string | null
  userAgent?: string | null
  cfRay?: string | null
  cfConnectingIp?: string | null
  cfCountry?: string | null
  cfDatacenter?: string | null
  forwardedHost?: string | null
  forwardedProto?: string | null
  url?: string | null
}

function safeHeader(headers: Headers | null | undefined, name: string) {
  try {
    return headers?.get(name) ?? null
  } catch {
    return null
  }
}

export function getCloudflareRequestInfo(
  request: Request | null | undefined,
  requestId: string = crypto.randomUUID(),
): CloudflareRequestInfo {
  if (!request) {
    return { requestId }
  }
  let url: URL | null = null
  try {
    url = new URL(request.url)
  } catch {
    url = null
  }
  const headers = request.headers

  return {
    requestId,
    method: request.method,
    path: url?.pathname ?? null,
    host: url?.host ?? null,
    origin: safeHeader(headers, 'origin'),
    referer: safeHeader(headers, 'referer'),
    userAgent: safeHeader(headers, 'user-agent'),
    cfRay: safeHeader(headers, 'cf-ray'),
    cfConnectingIp: safeHeader(headers, 'cf-connecting-ip'),
    cfCountry: safeHeader(headers, 'cf-ipcountry'),
    cfDatacenter: safeHeader(headers, 'cf-ipcontinent'),
    forwardedHost: safeHeader(headers, 'x-forwarded-host'),
    forwardedProto: safeHeader(headers, 'x-forwarded-proto'),
    url: url ? url.toString() : null,
  }
}

interface LogEntry {
  level: LogLevel
  event: string
  message: string
  time: string
  app: 'spends-web'
  cf?: CloudflareRequestInfo
  error?: unknown
  context?: LogContext
  durationMs?: number
}

function pickSink(level: LogLevel) {
  if (level === 'error') {
    return console.error.bind(console)
  }
  if (level === 'warn') {
    return console.warn.bind(console)
  }
  if (level === 'debug') {
    return (
      (console as Console & { debug?: typeof console.log }).debug ?? console.log
    ).bind(console)
  }
  return console.info.bind(console)
}

function emit(entry: LogEntry) {
  const sink = pickSink(entry.level)
  try {
    sink(JSON.stringify(entry))
  } catch {
    sink(`[server-logger] failed to stringify ${entry.event}`)
  }
}

export interface LogOptions {
  event: string
  message?: string
  request?: Request | null
  cf?: CloudflareRequestInfo
  context?: LogContext
  error?: unknown
  durationMs?: number
}

function makeEntry(level: LogLevel, opts: LogOptions): LogEntry {
  const cf =
    opts.cf ??
    (opts.request ? getCloudflareRequestInfo(opts.request) : undefined)
  const entry: LogEntry = {
    level,
    event: opts.event,
    message: opts.message ?? opts.event,
    time: new Date().toISOString(),
    app: 'spends-web',
  }
  if (cf) {
    entry.cf = cf
  }
  if (opts.error !== undefined) {
    entry.error = serializeError(opts.error)
  }
  if (opts.context) {
    entry.context = opts.context
  }
  if (typeof opts.durationMs === 'number') {
    entry.durationMs = Math.round(opts.durationMs)
  }
  return entry
}

export function logInfo(opts: LogOptions) {
  emit(makeEntry('info', opts))
}

export function logWarn(opts: LogOptions) {
  emit(makeEntry('warn', opts))
}

export function logError(opts: LogOptions) {
  emit(makeEntry('error', opts))
}

export function logDebug(opts: LogOptions) {
  emit(makeEntry('debug', opts))
}

/**
 * Wrap an async operation, emitting start/success/error events with timing.
 * Returns the operation's result so callers can `return` from a single line.
 */
export async function trace<T>(
  event: string,
  fn: () => Promise<T>,
  options: {
    request?: Request | null
    cf?: CloudflareRequestInfo
    context?: LogContext
    /** When true, log a start entry too. Defaults to false to keep logs lean. */
    logStart?: boolean
  } = {},
): Promise<T> {
  const start = performance.now()
  if (options.logStart) {
    logInfo({
      event: `${event}.start`,
      request: options.request ?? null,
      cf: options.cf,
      context: options.context,
    })
  }
  try {
    const result = await fn()
    logInfo({
      event: `${event}.success`,
      request: options.request ?? null,
      cf: options.cf,
      context: options.context,
      durationMs: performance.now() - start,
    })
    return result
  } catch (error) {
    logError({
      event: `${event}.error`,
      request: options.request ?? null,
      cf: options.cf,
      context: options.context,
      error,
      durationMs: performance.now() - start,
    })
    throw error
  }
}
