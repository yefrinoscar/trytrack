import type { ReactNode } from 'react'
import { ConvexProvider, ConvexReactClient } from 'convex/react'
import { getRequiredConvexUrl } from '#/lib/convex-public-env'

const convex = new ConvexReactClient(getRequiredConvexUrl())

export default function ConvexClientProvider({
  children,
}: {
  children: ReactNode
}) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>
}
