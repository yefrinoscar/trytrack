const missingHint =
  'Set VITE_CONVEX_URL and VITE_CONVEX_SITE_URL in your environment the same way as locally (e.g. .env or .env.production, or export them in CI). On Cloudflare, add them as variables available to the build step and run the production build again — runtime-only variables in the dashboard are not enough; Vite inlines VITE_ values at build time.'

/**
 * Public Convex deployment URL (https://…convex.cloud) used by the client and SSR.
 * Must be set when running `vp build` (Vite inlines `import.meta.env` at build time).
 */
export function getRequiredConvexUrl(): string {
  const u = (import.meta.env.VITE_CONVEX_URL || '').trim()
  if (!u) {
    throw new Error(`VITE_CONVEX_URL is not set. ${missingHint}`)
  }
  return u
}

/**
 * Convex site URL (https://…convex.site) for Better Auth. Not the .convex.cloud API URL.
 */
export function getRequiredConvexSiteUrl(): string {
  const u = (import.meta.env.VITE_CONVEX_SITE_URL || '').trim()
  if (!u) {
    throw new Error(`VITE_CONVEX_SITE_URL is not set. ${missingHint}`)
  }
  if (u.endsWith('.convex.cloud')) {
    throw new Error(
      'VITE_CONVEX_SITE_URL must be the https://….convex.site URL, not .convex.cloud.',
    )
  }
  return u.replace(/\/$/, '')
}
