import { createFileRoute } from '@tanstack/react-router'
import { handleGmailPubSubWebhook } from '#/lib/gmail-expense-sync'

export const Route = createFileRoute('/api/email/gmail/webhook')({
  server: {
    handlers: {
      OPTIONS: ({ request }) => handleGmailPubSubWebhook(request),
      POST: ({ request }) => handleGmailPubSubWebhook(request),
    },
  },
})
