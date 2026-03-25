import { Navigate, createFileRoute } from '@tanstack/react-router'

function IndexRedirect() {
  return <Navigate to="/debts" />
}

export const Route = createFileRoute('/')({ component: IndexRedirect })
