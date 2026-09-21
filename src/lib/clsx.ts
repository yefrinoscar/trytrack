/**
 * Class-name joiner used across the UI.
 *
 * Deliberately implemented locally instead of importing `clsx`. The SSR bundler
 * can hoist `clsx` into the browser-only @tanstack/router-devtools-core chunk
 * (its module scope calls `window`/`document`), which crashes the Cloudflare
 * Worker on every render. Keeping this dependency-free avoids that entirely.
 */
export type ClassValue =
  | string
  | number
  | bigint
  | null
  | boolean
  | undefined
  | ClassValue[]
  | Record<string, boolean | null | undefined>

function toClassName(value: ClassValue): string {
  if (!value) {
    return ''
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return String(value)
  }

  if (Array.isArray(value)) {
    return value.map(toClassName).filter(Boolean).join(' ')
  }

  if (typeof value === 'object') {
    return Object.entries(value)
      .filter(([, enabled]) => Boolean(enabled))
      .map(([key]) => key)
      .join(' ')
  }

  return ''
}

export function clsx(...inputs: ClassValue[]): string {
  return inputs.map(toClassName).filter(Boolean).join(' ')
}

export default clsx
