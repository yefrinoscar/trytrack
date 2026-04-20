import { createFileRoute } from '@tanstack/react-router'
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
  try {
    return JSON.stringify(err)
  } catch {
    return 'Request failed'
  }
}

function safeRedirectPath(candidate: string | undefined): string {
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) {
    return '/debts'
  }
  if (candidate === '/login' || candidate.startsWith('/login?')) {
    return '/debts'
  }
  return candidate
}

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: safeRedirectPath(
      typeof search.redirect === 'string' ? search.redirect : undefined,
    ),
  }),
  component: LoginPage,
})

function LoginPage() {
  const { redirect } = Route.useSearch()
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      if (mode === 'signUp') {
        const { error: err } = await authClient.signUp.email({
          email,
          password,
          name: name || email.split('@')[0] || 'User',
        })
        if (err) {
          setError(formatAuthError(err))
          return
        }
      } else {
        const { error: err } = await authClient.signIn.email({
          email,
          password,
        })
        if (err) {
          setError(formatAuthError(err))
          return
        }
      }
      window.location.assign(redirect)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong')
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
            Sign in to continue to Trytracker
          </p>
        </div>

        <div className="flex gap-2 rounded-lg border border-border bg-sidebar/40 p-1">
          <button
            type="button"
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              mode === 'signIn'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => {
              setMode('signIn')
              setError(null)
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              mode === 'signUp'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => {
              setMode('signUp')
              setError(null)
            }}
          >
            Create account
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {mode === 'signUp' ? (
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>
          ) : null}
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
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={
                mode === 'signUp' ? 'new-password' : 'current-password'
              }
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending
              ? 'Please wait…'
              : mode === 'signUp'
                ? 'Create account'
                : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  )
}
