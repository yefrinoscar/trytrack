import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
  useRouterState,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import Header from '../components/Header'

import TanStackQueryProvider from '../integrations/tanstack-query/root-provider'
import { ConvexClientProvider } from '../integrations/convex'

import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'

import appCss from '../styles.css?url'

import type { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
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
        href: '/favicon.svg',
      },
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const showDevtools = import.meta.env.DEV

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="font-sans antialiased [overflow-wrap:anywhere]">
        <TanStackQueryProvider>
          <ConvexClientProvider>
            <div className="mx-auto flex min-h-screen w-full max-w-[1320px] flex-col lg:px-4">
              <div className="relative flex min-h-0 flex-1 flex-col">
                <Header />
                <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:pl-[196px] lg:pt-10">
                  <div
                    key={pathname}
                    className="shell-route-enter flex min-h-0 flex-1 flex-col"
                  >
                    {children}
                  </div>
                </div>
              </div>
            </div>
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
          </ConvexClientProvider>
        </TanStackQueryProvider>
        <Scripts />
      </body>
    </html>
  )
}
