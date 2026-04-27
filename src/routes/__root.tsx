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
import { serializeError } from '#/lib/server-error'
import { logError, logInfo } from '#/lib/server-logger'

type AuthDiagnostic = {
  errorId: string
  stage: string
  message: string
  errorJson: string
  env: {
    convexUrl: string | null
    convexSiteUrl: string | null
    siteUrl: string | null
  }
  likelyCauses: string[]
}

type AuthResult = {
  token: string | null | undefined
  error: AuthDiagnostic | null
}

const getAuth = createServerFn({ method: 'GET' }).handler(async () => {
  try {
    const token = await getToken()
    logInfo({
      event: 'auth.root.get_auth_succeeded',
      message: 'Root loader auth resolved',
      context: { hasToken: Boolean(token) },
    })
    return {
      token,
      error: null,
    } satisfies AuthResult
  } catch (error) {
    const errorId = crypto.randomUUID()
    const details: AuthDiagnostic = {
      errorId,
      stage: 'root.getAuth',
      message:
        error instanceof Error
          ? error.message
          : 'Auth token lookup failed before rendering the route.',
      errorJson: JSON.stringify(serializeError(error), null, 2),
      env: {
        convexUrl: import.meta.env.VITE_CONVEX_URL || null,
        convexSiteUrl: import.meta.env.VITE_CONVEX_SITE_URL || null,
        siteUrl: import.meta.env.VITE_SITE_URL || null,
      },
      likelyCauses: [
        'VITE_CONVEX_SITE_URL is missing, points to .convex.cloud, or points to the app host instead of the .convex.site HTTP Actions URL.',
        'VITE_CONVEX_URL / VITE_CONVEX_SITE_URL were not available at Cloudflare build time, so Vite inlined empty values.',
        'The Convex Better Auth HTTP action is returning a 500/4xx. Check Cloudflare logs for the same errorId and Convex logs for the upstream request.',
      ],
    }

    logError({
      event: 'auth.root.get_auth_failed',
      message: 'Root loader auth lookup failed',
      error,
      context: {
        errorId,
        stage: details.stage,
        env: details.env,
      },
    })
    return {
      token: null,
      error: details,
    } satisfies AuthResult
  }
})

interface MyRouterContext {
  queryClient: QueryClient
  convexQueryClient: ConvexQueryClient
}

type RootRouteContext = MyRouterContext & {
  token?: string | null
  isAuthenticated?: boolean
  authError?: AuthDiagnostic | null
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
        authError: null,
      }
    }

    const auth = await getAuth()
    const token = auth.token
    if (auth.error) {
      return {
        isAuthenticated: false,
        token: null,
        authError: auth.error,
      }
    }

    if (token) {
      opts.context.convexQueryClient.serverHttpClient?.setAuth(token)
    }

    if (pathname.startsWith('/api/')) {
      return {
        isAuthenticated: !!token,
        token,
        authError: null,
      }
    }

    const publicRoutes = ['/login', '/forgot-password', '/reset-password']
    const isPublicRoute = publicRoutes.includes(pathname)

    if (isPublicRoute) {
      if (token && pathname === '/login') {
        throw redirect({ to: '/debts' })
      }
      return {
        isAuthenticated: Boolean(token),
        token,
        authError: null,
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
      authError: null,
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
  const { queryClient, convexQueryClient, token, authError } = routeCtx
  const authLayoutRoutes = ['/login', '/forgot-password', '/reset-password']
  const isAuthLayout = authLayoutRoutes.includes(pathname)

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
            {authError ? (
              <AuthFailure error={authError} />
            ) : isAuthLayout ? (
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

function AuthFailure({
  error,
}: {
  error: NonNullable<RootRouteContext['authError']>
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[980px] flex-col justify-center px-6 py-12">
      <div className="space-y-5">
        <div className="space-y-2">
          <p className="text-muted-foreground text-sm font-medium">
            Authentication failed before the page could render
          </p>
          <h1 className="text-foreground text-2xl font-semibold">
            {error.message}
          </h1>
        </div>
        <div className="rounded-md border border-border bg-sidebar/40 p-4">
          <dl className="grid gap-3 text-sm sm:grid-cols-[160px_1fr]">
            <dt className="text-muted-foreground">Error ID</dt>
            <dd className="font-mono text-foreground">{error.errorId}</dd>
            <dt className="text-muted-foreground">Stage</dt>
            <dd className="font-mono text-foreground">{error.stage}</dd>
            <dt className="text-muted-foreground">Convex URL</dt>
            <dd className="font-mono text-foreground">
              {error.env.convexUrl ?? 'missing'}
            </dd>
            <dt className="text-muted-foreground">Convex site URL</dt>
            <dd className="font-mono text-foreground">
              {error.env.convexSiteUrl ?? 'missing'}
            </dd>
            <dt className="text-muted-foreground">Site URL</dt>
            <dd className="font-mono text-foreground">
              {error.env.siteUrl ?? 'missing'}
            </dd>
          </dl>
        </div>
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">Likely causes</h2>
          <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
            {error.likelyCauses.map((cause) => (
              <li key={cause}>{cause}</li>
            ))}
          </ul>
        </div>
        <pre className="max-h-[360px] overflow-auto rounded-md border border-border bg-background p-4 text-xs text-foreground">
          {error.errorJson}
        </pre>
      </div>
    </main>
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
