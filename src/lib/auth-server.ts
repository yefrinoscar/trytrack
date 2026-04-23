import { convexBetterAuthReactStart } from '@convex-dev/better-auth/react-start'
import {
  getRequiredConvexSiteUrl,
  getRequiredConvexUrl,
} from '#/lib/convex-public-env'

type AuthServerHelpers = ReturnType<typeof convexBetterAuthReactStart>

let helpers: AuthServerHelpers | undefined

function getHelpers(): AuthServerHelpers {
  if (!helpers) {
    helpers = convexBetterAuthReactStart({
      convexUrl: getRequiredConvexUrl(),
      convexSiteUrl: getRequiredConvexSiteUrl(),
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
