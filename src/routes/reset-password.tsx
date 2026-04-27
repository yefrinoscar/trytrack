import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
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

type ResetSearch = {
  token: string | undefined
  error: string | undefined
}

export const Route = createFileRoute('/reset-password')({
  validateSearch: (search: Record<string, unknown>): ResetSearch => ({
    token: typeof search.token === 'string' ? search.token : undefined,
    error: typeof search.error === 'string' ? search.error : undefined,
  }),
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const { token, error: linkError } = Route.useSearch()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)

  const tokenInvalid = !token || linkError === 'INVALID_TOKEN'

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!token) {
      setError('Missing or invalid reset token.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setPending(true)
    try {
      const { error: err } = await authClient.resetPassword({
        newPassword: password,
        token,
      })
      if (err) {
        if (import.meta.env.DEV) {
          console.error('[auth] resetPassword failed', err)
        }
        setError(formatAuthError(err))
        return
      }
      setDone(true)
      setTimeout(() => {
        navigate({ to: '/login', search: { redirect: '/debts' } }).catch(
          () => undefined,
        )
      }, 1500)
    } catch (caught) {
      if (import.meta.env.DEV) {
        console.error('[auth] resetPassword threw', caught)
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
            {done
              ? 'Password updated. Redirecting to sign in…'
              : 'Choose a new password for your account'}
          </p>
        </div>

        {tokenInvalid ? (
          <div className="space-y-4">
            <div
              role="alert"
              className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-4 text-sm"
            >
              <p className="font-medium">
                This reset link is invalid or has expired.
              </p>
              <p className="text-destructive/80 mt-1">
                Reset links expire after 1 hour. Request a new one to continue.
              </p>
            </div>
            <Button asChild className="w-full">
              <Link to="/forgot-password">Request a new link</Link>
            </Button>
          </div>
        ) : done ? (
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-sidebar/40 p-4 text-sm">
              <p className="text-foreground font-medium">
                Your password was updated successfully.
              </p>
            </div>
            <Button asChild className="w-full">
              <Link to="/login" search={{ redirect: '/debts' }}>
                Continue to sign in
              </Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            {error ? (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? 'Updating…' : 'Update password'}
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
