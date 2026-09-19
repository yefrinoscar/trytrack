import { useEffect, useState } from 'react'

/**
 * Devtools are lazily imported so production SSR never evaluates the
 * browser-only devtools bundles in the Worker.
 */
export function AppDevtools({ enabled }: { enabled: boolean }) {
  const [panels, setPanels] = useState<{
    router: React.ComponentType
    query: React.ComponentType<{ client?: unknown }>
    Devtools: React.ComponentType<{
      config?: { position?: string }
      plugins: Array<{ name: string; render: React.ReactNode }>
    }>
  } | null>(null)

  useEffect(() => {
    if (!enabled) {
      return
    }

    let cancelled = false
    void Promise.all([
      import('@tanstack/react-devtools'),
      import('@tanstack/react-router-devtools'),
      import('@tanstack/react-query-devtools'),
    ]).then(([devtools, routerDevtools, queryDevtools]) => {
      if (cancelled) {
        return
      }
      setPanels({
        Devtools: devtools.TanStackDevtools as never,
        router: routerDevtools.TanStackRouterDevtoolsPanel,
        query: queryDevtools.ReactQueryDevtoolsPanel as never,
      })
    })

    return () => {
      cancelled = true
    }
  }, [enabled])

  if (!enabled || !panels) {
    return null
  }

  const { Devtools, router: RouterPanel, query: QueryPanel } = panels

  return (
    <Devtools
      config={{ position: 'bottom-right' }}
      plugins={[
        { name: 'Tanstack Router', render: <RouterPanel /> },
        { name: 'Tanstack Query', render: <QueryPanel /> },
      ]}
    />
  )
}
