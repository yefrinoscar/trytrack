import { createFileRoute } from '@tanstack/react-router'
import { handleGmailPoll } from '#/lib/gmail-expense-sync'

export const Route = createFileRoute('/api/email/gmail/poll')({
  server: {
    handlers: {
      OPTIONS: ({ request }) => handleGmailPoll(request),
      POST: ({ request }) => handleGmailPoll(request),
    },
  },
})
