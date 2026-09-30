import { Link } from '@tanstack/react-router'
import {
  CircleDollarSign,
  Landmark,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
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
import { cn } from '#/lib/utils'
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

const avatarClassName =
  'flex size-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-[radial-gradient(circle_at_top,color-mix(in_srgb,var(--accent)_24%,transparent),transparent_68%),color-mix(in_srgb,var(--surface-muted)_82%,var(--panel))] text-sm font-semibold tracking-[0.16em] text-foreground'

const accountMenuContentClassName =
  'w-52 rounded-2xl border-border bg-[color-mix(in_srgb,var(--popover)_92%,black)] p-1.5 shadow-[0_18px_48px_rgba(0,0,0,0.22)]'

/** Shared so the phone avatar and the desktop card offer the same items. */
function AccountMenuItems({ onSignOut }: { onSignOut: () => void }) {
  return (
    <>
      <DropdownMenuItem asChild>
        <Link to="/settings" className="cursor-pointer rounded-xl">
          <Settings className="h-4 w-4" />
          Configuration
        </Link>
      </DropdownMenuItem>
      <DropdownMenuSeparator className="bg-border/80" />
      <DropdownMenuItem
        className="cursor-pointer rounded-xl text-danger focus:bg-[color-mix(in_srgb,var(--danger)_12%,var(--popover))] focus:text-danger"
        onClick={onSignOut}
      >
        <LogOut className="h-4 w-4" />
        Logout
      </DropdownMenuItem>
    </>
  )
}

interface HeaderProps {
  isCollapsed: boolean
  onToggleCollapsed: () => void
}

/**
 * The same navigation in two shapes. From `lg` up it is the fixed sidebar it
 * always was. On a phone it collapses into a single sticky bar holding the
 * logo, the section icons and the account menu, so the menu is reachable
 * without a several-thousand-pixel scroll and the content starts at the top of
 * the screen instead of below a tall header.
 */
export default function Header({
  isCollapsed,
  onToggleCollapsed,
}: HeaderProps) {
  const { data: session } = authClient.useSession()
  const displayName = getDisplayName(session?.user)
  const initials = getInitials(displayName)

  const signOut = () => {
    void authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = '/login'
        },
      },
    })
  }

  return (
    <aside
      className={cn(
        'sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur',
        'lg:fixed lg:top-10 lg:z-10 lg:border-b-0 lg:bg-transparent lg:backdrop-blur-none',
        'lg:left-[max(1rem,calc((100vw-1320px)/2+1rem))]',
        isCollapsed ? 'lg:w-[72px]' : 'lg:w-[220px]',
      )}
    >
      <div className="px-3 py-2 sm:px-5 lg:p-0">
        <div className={cn('flex flex-col', isCollapsed ? 'gap-2' : 'gap-4')}>
          <div
            className={cn(
              'bg-sidebar relative lg:rounded-lg lg:pb-5 lg:pt-5',
              isCollapsed ? 'lg:px-2 lg:pt-4' : 'lg:px-4',
            )}
          >
            <div
              className={cn(
                'flex items-center gap-3',
                isCollapsed
                  ? 'lg:flex-col lg:justify-center lg:gap-2'
                  : 'lg:justify-between',
              )}
            >
              {/* On mobile the brand shrinks to the mark so the icons get room. */}
              <Link
                to="/debts"
                className={cn(
                  'tap-target inline-flex w-fit shrink-0 items-center no-underline',
                  isCollapsed && 'lg:hidden',
                )}
              >
                <span className="lg:hidden">
                  <img
                    alt="Trytracker"
                    className="h-9 w-9"
                    src="/favicon.svg"
                  />
                </span>
                <span className="hidden lg:inline">
                  <BrandLogo />
                </span>
              </Link>

              {isCollapsed ? (
                <Link
                  to="/debts"
                  className="hidden lg:inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border-strong bg-[linear-gradient(180deg,var(--panel),var(--sidebar))] shadow-sm"
                  title="Go to debts"
                >
                  <img
                    alt=""
                    aria-hidden="true"
                    className="h-6 w-6"
                    src="/favicon.svg"
                  />
                </Link>
              ) : null}

              {/*
               * Icon-only on a phone: a row of labels was wider than the screen
               * and scrolled sideways. Every item keeps a 44px hit area.
               */}
              <nav className="min-w-0 lg:hidden" aria-label="Main">
                <div className="flex items-center justify-end gap-0.5">
                  {navItems.map((item) => {
                    const Icon = item.icon

                    return item.disabled ? (
                      <span
                        key={item.to}
                        aria-disabled="true"
                        title={`${item.label} (coming soon)`}
                        className="sidebar-link sidebar-link-icon opacity-45 pointer-events-none"
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                    ) : (
                      <Link
                        key={item.to}
                        to={item.to}
                        title={item.label}
                        aria-label={item.label}
                        className="sidebar-link sidebar-link-icon"
                        activeProps={{
                          className:
                            'sidebar-link sidebar-link-icon sidebar-link-active',
                        }}
                      >
                        <Icon className="h-5 w-5" />
                      </Link>
                    )
                  })}
                </div>
              </nav>

              {!isCollapsed ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="hidden lg:inline-flex"
                  aria-label="Collapse menu"
                  title="Collapse menu"
                  onClick={onToggleCollapsed}
                >
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
              ) : null}

              {session?.user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={`Account menu for ${displayName}`}
                      className="ml-auto flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-[radial-gradient(circle_at_top,color-mix(in_srgb,var(--accent)_24%,transparent),transparent_68%),color-mix(in_srgb,var(--surface-muted)_82%,var(--panel))] text-xs font-semibold tracking-[0.12em] text-foreground lg:hidden"
                    >
                      {initials}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    sideOffset={6}
                    collisionPadding={12}
                    className={accountMenuContentClassName}
                  >
                    <AccountMenuItems onSignOut={signOut} />
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>

            {isCollapsed ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="hidden lg:mx-auto lg:flex mt-3 rounded-xl border border-border bg-sidebar hover:bg-muted shadow-sm"
                aria-label="Expand menu"
                title="Expand menu"
                onClick={onToggleCollapsed}
              >
                <PanelLeftOpen className="size-6" />
              </Button>
            ) : null}

            <nav className="mt-8 hidden lg:block" aria-label="Main">
              <div
                className={cn(
                  'flex flex-col gap-1.5',
                  isCollapsed && 'items-center',
                )}
              >
                {navItems.map((item) => {
                  const Icon = item.icon
                  const collapsedLinkClassName = isCollapsed
                    ? 'lg:size-12 lg:p-0 lg:justify-center lg:rounded-xl'
                    : ''

                  return item.disabled ? (
                    <span
                      key={item.to}
                      aria-disabled="true"
                      title={item.label}
                      className={cn(
                        'sidebar-link opacity-45 pointer-events-none',
                        collapsedLinkClassName,
                      )}
                    >
                      <Icon className={isCollapsed ? 'size-6' : 'h-4 w-4'} />
                      <span className={isCollapsed ? 'lg:hidden' : ''}>
                        {item.label}
                      </span>
                    </span>
                  ) : (
                    <Link
                      key={item.to}
                      to={item.to}
                      title={item.label}
                      className={cn('sidebar-link', collapsedLinkClassName)}
                      activeProps={{
                        className: `sidebar-link sidebar-link-active ${
                          isCollapsed
                            ? 'lg:after:absolute lg:after:bottom-0.5 lg:after:left-1/2 lg:after:-translate-x-1/2 lg:after:h-1 lg:after:w-1 lg:after:rounded-full lg:after:bg-accent'
                            : ''
                        }`,
                      }}
                    >
                      <Icon className={isCollapsed ? 'size-6' : 'h-4 w-4'} />
                      <span className={isCollapsed ? 'lg:hidden' : ''}>
                        {item.label}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </nav>
          </div>

          {session?.user ? (
            <div
              className={cn(
                'relative hidden overflow-hidden rounded-[1.35rem] border border-border bg-[linear-gradient(180deg,color-mix(in_srgb,var(--panel-elevated)_84%,transparent),color-mix(in_srgb,var(--sidebar)_92%,black))] shadow-[0_18px_48px_rgba(0,0,0,0.18)] lg:block',
                isCollapsed ? 'p-1.5 lg:mx-auto' : 'p-4',
              )}
            >
              <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-[linear-gradient(90deg,transparent,color-mix(in_srgb,var(--accent)_32%,transparent),transparent)]" />

              <div
                className={cn(
                  'flex items-start',
                  isCollapsed ? 'flex-col items-center gap-2' : 'gap-3',
                )}
              >
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto w-auto rounded-2xl p-0 hover:bg-transparent"
                      aria-label={`Account menu for ${displayName}`}
                    >
                      <div className={avatarClassName}>{initials}</div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    sideOffset={6}
                    className={accountMenuContentClassName}
                  >
                    <AccountMenuItems onSignOut={signOut} />
                  </DropdownMenuContent>
                </DropdownMenu>

                <div
                  className={cn('min-w-0 flex-1 pr-1', isCollapsed && 'hidden')}
                >
                  <p className="truncate text-sm font-semibold text-foreground">
                    {displayName}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {session.user.email}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  )
}
