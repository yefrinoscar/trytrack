import { createFileRoute } from '@tanstack/react-router'
import { OverviewPage } from '@/features/finance/pages/overview-page'

export const Route = createFileRoute('/')({ component: OverviewPage })
