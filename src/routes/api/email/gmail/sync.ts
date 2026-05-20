import { createFileRoute } from '@tanstack/react-router'
import { handleGmailSync } from '#/lib/gmail-expense-sync'

export const Route = createFileRoute('/api/email/gmail/sync')({
  server: {
    handlers: {
      OPTIONS: ({ request }) => handleGmailSync(request),
      POST: ({ request }) => handleGmailSync(request),
    },
  },
})
