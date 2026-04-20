import { convexBetterAuthReactStart } from '@convex-dev/better-auth/react-start'

type AuthServerHelpers = ReturnType<typeof convexBetterAuthReactStart>

let helpers: AuthServerHelpers | undefined

function getHelpers(): AuthServerHelpers {
  if (!helpers) {
    const convexUrl = process.env.VITE_CONVEX_URL
    const convexSiteUrl = process.env.VITE_CONVEX_SITE_URL
    if (!convexUrl || !convexSiteUrl) {
      throw new Error(
        'Missing VITE_CONVEX_URL or VITE_CONVEX_SITE_URL. Copy .env.example to .env.local, run `npx convex dev`, and paste both URLs from the Convex dashboard (site URL must end in .convex.site).',
      )
    }
    if (convexSiteUrl.endsWith('.convex.cloud')) {
      throw new Error(
        'VITE_CONVEX_SITE_URL must be the https://….convex.site URL, not .convex.cloud.',
      )
    }
    helpers = convexBetterAuthReactStart({
      convexUrl,
      convexSiteUrl: convexSiteUrl.replace(/\/$/, ''),
    })
  }
  return helpers
}

export function handler(request: Request) {
  return getHelpers().handler(request)
}

export function getToken() {
  return getHelpers().getToken()
}
