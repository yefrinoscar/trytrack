const missingHint =
  'Set VITE_CONVEX_URL and VITE_CONVEX_SITE_URL in your environment the same way as locally (e.g. .env or .env.production, or export them in CI). On Cloudflare, add them as variables available to the build step and run the production build again — runtime-only variables in the dashboard are not enough; Vite inlines VITE_ values at build time.'

function parseRequiredUrl(name: string, rawValue: string) {
  const value = rawValue.trim()
  if (!value) {
    return {
      value: null,
      error: `${name} is not set. ${missingHint}`,
    } as const
  }

  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        value: null,
        error: `${name} must be an http(s) URL. Received: ${value}`,
      } as const
    }
  } catch {
    return {
      value: null,
      error: `${name} is not a valid URL. Received: ${value}`,
    } as const
  }

  return {
    value,
    error: null,
  } as const
}

/**
 * Public Convex deployment URL (https://…convex.cloud) used by the client and SSR.
 * Must be set when running `vp build` (Vite inlines `import.meta.env` at build time).
 */
export function getOptionalConvexUrl() {
  return parseRequiredUrl(
    'VITE_CONVEX_URL',
    import.meta.env.VITE_CONVEX_URL || '',
  ).value
}

export function getConvexUrlError() {
  return parseRequiredUrl(
    'VITE_CONVEX_URL',
    import.meta.env.VITE_CONVEX_URL || '',
  ).error
}

export function getRequiredConvexUrl(): string {
  const parsed = parseRequiredUrl(
    'VITE_CONVEX_URL',
    import.meta.env.VITE_CONVEX_URL || '',
  )
  if (parsed.error) {
    throw new Error(parsed.error)
  }
  return parsed.value
}

/**
 * Convex site URL (https://…convex.site) for Better Auth. Not the .convex.cloud API URL.
 */
export function getOptionalConvexSiteUrl() {
  const parsed = parseRequiredUrl(
    'VITE_CONVEX_SITE_URL',
    import.meta.env.VITE_CONVEX_SITE_URL || '',
  )
  if (!parsed.value) {
    return null
  }
  if (parsed.value.endsWith('.convex.cloud')) {
    return null
  }
  return parsed.value.replace(/\/$/, '')
}

export function getConvexSiteUrlError() {
  const parsed = parseRequiredUrl(
    'VITE_CONVEX_SITE_URL',
    import.meta.env.VITE_CONVEX_SITE_URL || '',
  )
  if (parsed.error) {
    return parsed.error
  }
  if (parsed.value.endsWith('.convex.cloud')) {
    return 'VITE_CONVEX_SITE_URL must be the https://….convex.site URL, not .convex.cloud.'
  }
  return null
}

export function getRequiredConvexSiteUrl(): string {
  const parsed = parseRequiredUrl(
    'VITE_CONVEX_SITE_URL',
    import.meta.env.VITE_CONVEX_SITE_URL || '',
  )
  if (parsed.error) {
    throw new Error(parsed.error)
  }
  if (parsed.value.endsWith('.convex.cloud')) {
    throw new Error(
      'VITE_CONVEX_SITE_URL must be the https://….convex.site URL, not .convex.cloud.',
    )
  }
  return parsed.value.replace(/\/$/, '')
}
