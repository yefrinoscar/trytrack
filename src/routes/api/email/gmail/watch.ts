import { createFileRoute } from '@tanstack/react-router'
import { handleGmailWatch } from '#/lib/gmail-expense-sync'

export const Route = createFileRoute('/api/email/gmail/watch')({
  server: {
    handlers: {
      OPTIONS: ({ request }) => handleGmailWatch(request),
      POST: ({ request }) => handleGmailWatch(request),
    },
  },
})
