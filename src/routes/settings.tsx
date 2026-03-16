import { createFileRoute } from '@tanstack/react-router'
import { SettingsPage } from '@/features/finance/pages/settings-page'

export const Route = createFileRoute('/settings')({ component: SettingsPage })
