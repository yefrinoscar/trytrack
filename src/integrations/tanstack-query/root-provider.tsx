import type { ReactNode } from 'react'

/** @deprecated QueryClient is provided from router context in __root.tsx */
export default function TanStackQueryProvider({
  children,
}: {
  children: ReactNode
}) {
  return children
}
