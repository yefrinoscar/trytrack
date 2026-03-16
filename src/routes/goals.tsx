import { createFileRoute } from '@tanstack/react-router'
import { GoalsPage } from '@/features/finance/pages/goals-page'

export const Route = createFileRoute('/goals')({ component: GoalsPage })
