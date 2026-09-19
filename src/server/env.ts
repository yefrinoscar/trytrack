/**
 * Runtime environment accessor. On Cloudflare the Nitro module handler exposes
 * the Worker `env` through `globalThis.__env__`; in local Node dev/builds we
 * fall back to `process.env`.
 */
type CloudflareGlobal = typeof globalThis & {
  __env__?: Record<string, unknown>
}

export function getEnv(name: string): string | undefined {
  const fromProcess = process.env[name]
  if (typeof fromProcess === 'string' && fromProcess.length > 0) {
    return fromProcess
  }

  const value = (globalThis as CloudflareGlobal).__env__?.[name]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

export function getEnvNumber(name: string): number | undefined {
  const value = getEnv(name)
  if (!value) {
    return undefined
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function getSiteUrl(): string {
  const raw =
    getEnv('SITE_URL') ??
    getEnv('BETTER_AUTH_URL') ??
    getEnv('PUBLIC_APP_URL') ??
    getEnv('APP_URL') ??
    'http://localhost:3000'
  return raw.replace(/\/$/, '')
}
