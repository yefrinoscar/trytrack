import { createFileRoute } from '@tanstack/react-router'
import { DebtsPage } from '@/features/finance/pages/debts-page'

export const Route = createFileRoute('/debts')({ component: DebtsPage })
