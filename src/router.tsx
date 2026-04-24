import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import {
  QueryClient,
  dehydrate,
  hydrate,
  notifyManager,
} from '@tanstack/react-query'
import { ConvexQueryClient } from '@convex-dev/react-query'
import { getRequiredConvexUrl } from '#/lib/convex-public-env'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  if (typeof document !== 'undefined') {
    notifyManager.setScheduler(window.requestAnimationFrame)
  }

  const convexUrl = getRequiredConvexUrl()

  const convexQueryClient = new ConvexQueryClient(convexUrl, {
    expectAuth: false,
  })

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
      },
    },
  })
  convexQueryClient.connect(queryClient)

  const router = createTanStackRouter({
    routeTree,
    context: { queryClient, convexQueryClient },
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  })

  const ogHydrate = router.options.hydrate
  const ogDehydrate = router.options.dehydrate

  router.options.dehydrate = async () => {
    const dehydrated = await ogDehydrate?.()
    const dehydratedQueryClient = dehydrate(queryClient)

    if (dehydratedQueryClient.queries.length === 0) {
      return dehydrated
    }

    return {
      ...dehydrated,
      dehydratedQueryClient,
    }
  }

  router.options.hydrate = async (dehydrated) => {
    await ogHydrate?.(dehydrated)

    if (
      dehydrated &&
      typeof dehydrated === 'object' &&
      'dehydratedQueryClient' in dehydrated &&
      dehydrated.dehydratedQueryClient
    ) {
      hydrate(queryClient, dehydrated.dehydratedQueryClient)
    }
  }

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
