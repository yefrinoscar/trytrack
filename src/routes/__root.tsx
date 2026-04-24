import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
  redirect,
  useRouteContext,
  useRouterState,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { useEffect } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react'
import type { ConvexQueryClient } from '@convex-dev/react-query'
import { createServerFn } from '@tanstack/react-start'
import Header from '../components/Header'
import {
  DASHBOARD_SETTINGS_CHANGE_EVENT,
  getStoredDashboardSettings,
} from '../lib/finance'

import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'

import appCss from '../styles.css?url'

import { authClient } from '#/lib/auth-client'
import { getToken } from '#/lib/auth-server'

const getAuth = createServerFn({ method: 'GET' }).handler(async () => {
  try {
    const token = await getToken()
    console.info('[auth/root] getAuth:ok', {
      hasToken: Boolean(token),
    })
    return token
  } catch (error) {
    console.error('[auth/root] getAuth:failed', {
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
              cause: error.cause,
            }
          : error,
      convexUrl: process.env.VITE_CONVEX_URL ?? null,
      convexSiteUrl: process.env.VITE_CONVEX_SITE_URL ?? null,
      siteUrl: process.env.VITE_SITE_URL ?? null,
    })
    throw error
  }
})

interface MyRouterContext {
  queryClient: QueryClient
  convexQueryClient: ConvexQueryClient
}

type RootRouteContext = MyRouterContext & {
  token?: string | null
  isAuthenticated?: boolean
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Trytracker',
      },
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
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  beforeLoad: async (opts) => {
    const pathname = opts.location.pathname
    const search = opts.location.searchStr ?? ''

    if (pathname.startsWith('/api/auth')) {
      return {
        isAuthenticated: false,
        token: undefined,
      }
    }

    const token = await getAuth()
    if (token) {
      opts.context.convexQueryClient.serverHttpClient?.setAuth(token)
    }

    if (pathname.startsWith('/api/')) {
      return {
        isAuthenticated: !!token,
        token,
      }
    }

    if (pathname === '/login') {
      if (token) {
        throw redirect({ to: '/debts' })
      }
      return {
        isAuthenticated: false,
        token,
      }
    }

    if (!token) {
      const back = `${pathname}${search}`
      throw redirect({
        to: '/login',
        search: { redirect: back },
      })
    }

    return {
      isAuthenticated: true,
      token,
    }
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
  const { queryClient, convexQueryClient, token } = routeCtx
  const isLogin = pathname === '/login'

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
          <ConvexBetterAuthProvider
            client={convexQueryClient.convexClient}
            authClient={authClient}
            initialToken={token ?? null}
          >
            <DashboardAppearanceSync />
            {isLogin ? (
              <div className="bg-background flex min-h-screen flex-col">
                {children}
              </div>
            ) : (
              <div className="mx-auto flex min-h-screen w-full max-w-[1320px] flex-col lg:px-4">
                <div className="relative flex min-h-0 flex-1 flex-col">
                  <Header />
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:pl-[236px] lg:pt-10">
                    <div className="shell-route-enter flex min-h-0 flex-1 flex-col">
                      {children}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {showDevtools ? (
              <TanStackDevtools
                config={{
                  position: 'bottom-right',
                }}
                plugins={[
                  {
                    name: 'Tanstack Router',
                    render: <TanStackRouterDevtoolsPanel />,
                  },
                  TanStackQueryDevtools,
                ]}
              />
            ) : null}
          </ConvexBetterAuthProvider>
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
