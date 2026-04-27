import { Link, createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { authClient } from '#/lib/auth-client'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { BrandLogo } from '#/components/brand-logo'

function formatAuthError(err: unknown): string {
  if (err == null) {
    return 'Request failed'
  }
  if (typeof err === 'string') {
    return err
  }
  if (err instanceof Error) {
    return err.message
  }
  if (typeof err === 'object') {
    const e = err as Record<string, unknown>
    if (typeof e.message === 'string' && e.message.length > 0) {
      return e.message
    }
    if (typeof e.statusText === 'string' && e.statusText.length > 0) {
      return e.statusText
    }
    if (typeof e.code === 'string') {
      return e.code
    }
  }
  return 'Request failed'
}

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      const redirectTo = `${window.location.origin}/reset-password`
      const { error: err } = await authClient.forgetPassword({
        email,
        redirectTo,
      })
      if (err) {
        if (import.meta.env.DEV) {
          console.error('[auth] forgetPassword failed', err)
        }
        setError(formatAuthError(err))
        return
      }
      setSubmitted(true)
    } catch (caught) {
      if (import.meta.env.DEV) {
        console.error('[auth] forgetPassword threw', caught)
      }
      setError(
        caught instanceof Error ? caught.message : 'Something went wrong',
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-[380px] space-y-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <BrandLogo />
          <p className="text-muted-foreground text-sm">
            {submitted
              ? 'Check your email for a reset link'
              : 'Enter your email and we will send you a reset link'}
          </p>
        </div>

        {submitted ? (
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-sidebar/40 p-4 text-sm">
              <p className="text-foreground font-medium">
                If an account exists for{' '}
                <span className="font-mono">{email}</span>, you will receive an
                email with a link to reset your password.
              </p>
              <p className="text-muted-foreground mt-2">
                The link expires in 1 hour. If it does not arrive, check your
                spam folder.
              </p>
            </div>
            <Button asChild variant="outline" className="w-full">
              <Link to="/login" search={{ redirect: '/debts' }}>
                Back to sign in
              </Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            {error ? (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? 'Sending…' : 'Send reset link'}
            </Button>
            <p className="text-center text-sm">
              <Link
                to="/login"
                search={{ redirect: '/debts' }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
