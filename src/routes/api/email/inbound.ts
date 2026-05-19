import { createFileRoute } from '@tanstack/react-router'
import { handleResendInboundEmail } from '#/lib/resend-inbound'

export const Route = createFileRoute('/api/email/inbound')({
  server: {
    handlers: {
      OPTIONS: ({ request }) => handleResendInboundEmail(request),
      POST: ({ request }) => handleResendInboundEmail(request),
    },
  },
})
