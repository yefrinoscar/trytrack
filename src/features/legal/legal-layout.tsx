import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { BrandLogo } from '@/components/brand-logo'

/**
 * Shared shell for the public legal pages (privacy policy, terms of service).
 * These URLs are linked from the Google OAuth consent screen, so they must be
 * reachable without signing in.
 */
export function LegalPage({
  title,
  updatedAt,
  children,
}: {
  title: string
  updatedAt: string
  children: ReactNode
}) {
  return (
    <div className="bg-background flex min-h-screen flex-col">
      <header className="border-b border-border">
        <div className="page-wrap flex items-center justify-between px-4 py-5">
          <BrandLogo />
          <nav className="flex items-center gap-4 text-sm">
            <Link
              className="text-muted-foreground hover:text-foreground transition-colors"
              to="/privacy"
            >
              Privacy
            </Link>
            <Link
              className="text-muted-foreground hover:text-foreground transition-colors"
              to="/terms"
            >
              Terms
            </Link>
          </nav>
        </div>
      </header>

      <main className="page-wrap flex-1 px-4 py-10">
        <div className="mx-auto max-w-[760px]">
          <h1 className="text-foreground text-3xl font-semibold tracking-tight">
            {title}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Last updated: {updatedAt}
          </p>
          <div className="legal-prose mt-8 space-y-8">{children}</div>
        </div>
      </main>

      <footer className="border-t border-border">
        <div className="page-wrap text-muted-foreground px-4 py-6 text-xs">
          Trytracker ·{' '}
          <Link className="hover:text-foreground" to="/privacy">
            Privacy Policy
          </Link>{' '}
          ·{' '}
          <Link className="hover:text-foreground" to="/terms">
            Terms of Service
          </Link>
        </div>
      </footer>
    </div>
  )
}

export function LegalSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-foreground text-lg font-semibold">{title}</h2>
      <div className="text-muted-foreground space-y-3 text-sm leading-relaxed">
        {children}
      </div>
    </section>
  )
}
