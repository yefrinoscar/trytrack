import { createFileRoute } from '@tanstack/react-router'
import { InvestmentsPage } from '@/features/finance/pages/investments-page'

export const Route = createFileRoute('/investments')({ component: InvestmentsPage })
