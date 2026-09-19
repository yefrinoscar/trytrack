import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
  redirect,
  useRouteContext,
  useRouterState,
} from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'
import Header from '../components/Header'
import {
  DASHBOARD_SETTINGS_CHANGE_EVENT,
  getStoredDashboardSettings,
} from '../lib/finance'

import { AppDevtools } from '../integrations/tanstack-query/devtools'

import appCss from '../styles.css?url'

type AuthResult = {
  isAuthenticated: boolean
  email: string | null
}

const getAuth = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AuthResult> => {
    const { getSession } = await import('#/server/auth')
    const session = await getSession()
    return {
      isAuthenticated: Boolean(session?.user),
      email: session?.user?.email ?? null,
    }
  },
)

interface MyRouterContext {
  queryClient: QueryClient
}

type RootRouteContext = MyRouterContext & {
  isAuthenticated?: boolean
}

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'trytrack:sidebar-collapsed'

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      { title: 'Trytracker' },
    ],
    links: [
      {
        rel: 'icon',
        type: 'image/svg+xml',
        sizes: 'any',
        href: '/favicon.svg?v=3',
      },
      {
        rel: 'shortcut icon',
        type: 'image/svg+xml',
        href: '/favicon.svg?v=3',
      },
      { rel: 'stylesheet', href: appCss },
    ],
  }),
  beforeLoad: async (opts) => {
    const pathname = opts.location.pathname
    const search = opts.location.searchStr ?? ''

    if (pathname.startsWith('/api/')) {
      return { isAuthenticated: false }
    }

    const auth = await getAuth()
    const isAuthenticated = auth.isAuthenticated

    const publicRoutes = ['/login', '/forgot-password', '/reset-password']
    const isPublicRoute = publicRoutes.includes(pathname)

    if (isPublicRoute) {
      if (isAuthenticated && pathname === '/login') {
        throw redirect({ to: '/debts' })
      }
      return { isAuthenticated }
    }

    if (!isAuthenticated) {
      const back = `${pathname}${search}`
      throw redirect({
        to: '/login',
        search: { redirect: back },
      })
    }

    return { isAuthenticated: true }
  },
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const showDevtools = import.meta.env.DEV
  const initialSettings =
    typeof window === 'undefined' ? null : getStoredDashboardSettings()

  const routeCtx = useRouteContext({ from: Route.id }) as RootRouteContext
  const { queryClient } = routeCtx
  const authLayoutRoutes = ['/login', '/forgot-password', '/reset-password']
  const isAuthLayout = authLayoutRoutes.includes(pathname)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)
    setIsSidebarCollapsed(stored === '1')
  }, [])

  useEffect(() => {
    window.localStorage.setItem(
      SIDEBAR_COLLAPSED_STORAGE_KEY,
      isSidebarCollapsed ? '1' : '0',
    )
  }, [isSidebarCollapsed])

  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-motion={initialSettings?.motion ?? 'full'}
      data-theme={initialSettings?.theme ?? 'dark'}
    >
      <head>
        <HeadContent />
      </head>
      <body className="font-sans antialiased [overflow-wrap:anywhere]">
        <QueryClientProvider client={queryClient}>
          <DashboardAppearanceSync />
          {isAuthLayout ? (
            <div className="bg-background flex min-h-screen flex-col">
              {children}
            </div>
          ) : (
            <div className="mx-auto flex min-h-screen w-full max-w-[1320px] flex-col lg:px-4">
              <div className="relative flex min-h-0 flex-1 flex-col">
                <Header
                  isCollapsed={isSidebarCollapsed}
                  onToggleCollapsed={() =>
                    setIsSidebarCollapsed((current) => !current)
                  }
                />
                <div
                  className={`flex min-h-0 min-w-0 flex-1 flex-col lg:pt-10 ${
                    isSidebarCollapsed ? 'lg:pl-[88px]' : 'lg:pl-[236px]'
                  }`}
                >
                  <div className="shell-route-enter flex min-h-0 flex-1 flex-col">
                    {children}
                  </div>
                </div>
              </div>
            </div>
          )}
          {showDevtools ? <AppDevtools enabled={showDevtools} /> : null}
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  )
}

function DashboardAppearanceSync() {
  useEffect(() => {
    const syncAppearance = () => {
      const settings = getStoredDashboardSettings()
      document.documentElement.dataset.theme = settings.theme
      document.documentElement.dataset.motion = settings.motion
    }

    syncAppearance()

    window.addEventListener(DASHBOARD_SETTINGS_CHANGE_EVENT, syncAppearance)
    window.addEventListener('storage', syncAppearance)

    return () => {
      window.removeEventListener(
        DASHBOARD_SETTINGS_CHANGE_EVENT,
        syncAppearance,
      )
      window.removeEventListener('storage', syncAppearance)
    }
  }, [])

  return null
}
