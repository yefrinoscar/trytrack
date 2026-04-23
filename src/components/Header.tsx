import { Link } from '@tanstack/react-router'
import {
  CircleDollarSign,
  Landmark,
  LogOut,
  MoreHorizontal,
  Settings,
  Target,
  TrendingUp,
} from 'lucide-react'
import { authClient } from '#/lib/auth-client'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { BrandLogo } from './brand-logo'

const navItems = [
  { to: '/debts', label: 'Debt', icon: Landmark, disabled: false },
  { to: '/incomes', label: 'Income', icon: CircleDollarSign, disabled: true },
  { to: '/investments', label: 'Invest', icon: TrendingUp, disabled: true },
  { to: '/goals', label: 'Goals', icon: Target, disabled: true },
] as const

function getDisplayName(
  user: { name?: string | null; email?: string | null } | undefined,
) {
  const name = user?.name?.trim()
  if (name) {
    return name
  }

  const emailName = user?.email?.split('@')[0]?.trim()
  if (emailName) {
    return emailName
  }

  return 'User'
}

function getInitials(value: string) {
  const parts = value
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length === 0) {
    return 'U'
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }

  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}

export default function Header() {
  const { data: session } = authClient.useSession()
  const displayName = getDisplayName(session?.user)
  const initials = getInitials(displayName)

  return (
    <aside className="border-b border-border pt-16 lg:fixed lg:top-10 lg:left-[max(1rem,calc((100vw-1320px)/2+1rem))] lg:z-10 lg:w-[220px] lg:border-b-0 lg:pt-0">
      <div className="px-4 pb-4 pt-4 sm:px-5 lg:px-0 lg:pb-0 lg:pt-0">
        <div className="flex flex-col gap-4">
          <div className="bg-sidebar lg:rounded-lg lg:px-4 lg:pb-5 lg:pt-5">
            <div className="flex items-center justify-between gap-3 lg:block">
              <Link
                to="/debts"
                className="inline-flex w-fit items-center no-underline"
              >
                <BrandLogo />
              </Link>
            </div>

            <nav className="mt-4 overflow-x-auto lg:mt-8 lg:overflow-visible">
              <div className="flex min-w-max gap-1.5 lg:flex-col lg:min-w-0">
                {navItems.map((item) => {
                  const Icon = item.icon

                  return item.disabled ? (
                    <span
                      key={item.to}
                      aria-disabled="true"
                      className="sidebar-link opacity-45 pointer-events-none"
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </span>
                  ) : (
                    <Link
                      key={item.to}
                      to={item.to}
                      className="sidebar-link"
                      activeProps={{
                        className: 'sidebar-link sidebar-link-active',
                      }}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </nav>
          </div>

          {session?.user ? (
            <div className="relative overflow-hidden rounded-[1.35rem] border border-border bg-[linear-gradient(180deg,color-mix(in_srgb,var(--panel-elevated)_84%,transparent),color-mix(in_srgb,var(--sidebar)_92%,black))] p-4 shadow-[0_18px_48px_rgba(0,0,0,0.18)]">
              <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-[linear-gradient(90deg,transparent,color-mix(in_srgb,var(--accent)_32%,transparent),transparent)]" />

              <div className="flex items-start gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-[radial-gradient(circle_at_top,color-mix(in_srgb,var(--accent)_24%,transparent),transparent_68%),color-mix(in_srgb,var(--surface-muted)_82%,var(--panel))] text-sm font-semibold tracking-[0.16em] text-foreground">
                  {initials}
                </div>

                <div className="min-w-0 flex-1 pr-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {displayName}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {session.user.email}
                  </p>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="mt-0.5 rounded-full border border-transparent text-muted-foreground hover:border-border hover:bg-background/70 hover:text-foreground"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-52 rounded-2xl border-border bg-[color-mix(in_srgb,var(--popover)_92%,black)] p-1.5 shadow-[0_18px_48px_rgba(0,0,0,0.22)]"
                  >
                    <DropdownMenuItem asChild>
                      <Link
                        to="/settings"
                        className="cursor-pointer rounded-xl"
                      >
                        <Settings className="h-4 w-4" />
                        Configuration
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-border/80" />
                    <DropdownMenuItem
                      className="cursor-pointer rounded-xl text-danger focus:bg-[color-mix(in_srgb,var(--danger)_12%,var(--popover))] focus:text-danger"
                      onClick={() => {
                        void authClient.signOut({
                          fetchOptions: {
                            onSuccess: () => {
                              window.location.href = '/login'
                            },
                          },
                        })
                      }}
                    >
                      <LogOut className="h-4 w-4" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  )
}
