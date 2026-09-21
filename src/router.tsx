import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import {
  QueryClient,
  dehydrate,
  hydrate,
  notifyManager,
} from '@tanstack/react-query'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  if (typeof document !== 'undefined') {
    notifyManager.setScheduler(window.requestAnimationFrame)
  }

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
    },
  })

  const router = createTanStackRouter({
    routeTree,
    context: { queryClient },
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
