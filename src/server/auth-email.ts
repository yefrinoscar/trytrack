import { getEnv } from './env'

type ResetPasswordPayload = {
  user: { email: string; name?: string | null }
  url: string
  token: string
}

export async function sendResetPasswordEmail(payload: ResetPasswordPayload) {
  const apiKey = getEnv('RESEND_API_KEY')
  const from = getEnv('RESEND_FROM_EMAIL')
  const requestId = crypto.randomUUID()

  if (!apiKey || !from) {
    console.warn(
      JSON.stringify({
        level: 'warn',
        event: 'auth.reset_password.email_skipped',
        requestId,
        message:
          'RESEND_API_KEY / RESEND_FROM_EMAIL not configured. Logging reset URL instead of sending an email.',
        email: payload.user.email,
        resetUrl: payload.url,
      }),
    )
    return
  }

  const subject = 'Reset your Trytracker password'
  const greeting = payload.user.name ? `Hi ${payload.user.name},` : 'Hi,'
  const html = [
    `<p>${greeting}</p>`,
    '<p>We received a request to reset your Trytracker password.</p>',
    `<p><a href="${payload.url}" style="display:inline-block;padding:10px 16px;border-radius:8px;background:#111;color:#fff;text-decoration:none">Reset password</a></p>`,
    `<p>Or paste this link into your browser:<br><code>${payload.url}</code></p>`,
    '<p>If you did not request this, you can safely ignore this email. The link expires in 1 hour.</p>',
  ].join('\n')

  const text = [
    greeting,
    '',
    'We received a request to reset your Trytracker password.',
    `Reset link: ${payload.url}`,
    '',
    'If you did not request this, you can safely ignore this email. The link expires in 1 hour.',
  ].join('\n')

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: payload.user.email,
        subject,
        html,
        text,
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'auth.reset_password.email_failed',
          requestId,
          status: res.status,
          statusText: res.statusText,
          email: payload.user.email,
          body: body.slice(0, 500),
        }),
      )
      return
    }

    console.info(
      JSON.stringify({
        level: 'info',
        event: 'auth.reset_password.email_sent',
        requestId,
        email: payload.user.email,
      }),
    )
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'auth.reset_password.email_error',
        requestId,
        email: payload.user.email,
        error: error instanceof Error ? error.message : String(error),
      }),
    )
  }
}
