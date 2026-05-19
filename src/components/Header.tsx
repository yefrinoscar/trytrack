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

interface HeaderProps {
  isCollapsed: boolean
  onToggleCollapsed: () => void
}

export default function Header({
  isCollapsed,
  onToggleCollapsed,
}: HeaderProps) {
  const { data: session } = authClient.useSession()
  const displayName = getDisplayName(session?.user)
  const initials = getInitials(displayName)

  return (
    <aside
      className={`border-b border-border pt-16 lg:fixed lg:top-10 lg:left-[max(1rem,calc((100vw-1320px)/2+1rem))] lg:z-10 lg:border-b-0 lg:pt-0 ${
        isCollapsed ? 'lg:w-[72px]' : 'lg:w-[220px]'
      }`}
    >
      <div className="px-4 pb-4 pt-4 sm:px-5 lg:px-0 lg:pb-0 lg:pt-0">
        <div className={`flex flex-col ${isCollapsed ? 'gap-2' : 'gap-4'}`}>
          <div
            className={`bg-sidebar relative lg:rounded-lg lg:pb-5 lg:pt-5 ${
              isCollapsed ? 'lg:px-2 lg:pt-4' : 'lg:px-4'
            }`}
          >
            <div
              className={`flex items-center ${
                isCollapsed
                  ? 'flex-col justify-center gap-2'
                  : 'justify-between gap-3'
              }`}
            >
              <Link
                to="/debts"
                className={`inline-flex w-fit items-center no-underline ${
                  isCollapsed ? 'lg:hidden' : ''
                }`}
              >
                <BrandLogo />
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

            <nav className="mt-4 overflow-x-auto lg:mt-8 lg:overflow-visible">
              <div
                className={`flex min-w-max gap-1.5 lg:flex-col lg:min-w-0 ${
                  isCollapsed ? 'lg:items-center' : ''
                }`}
              >
                {navItems.map((item) => {
                  const Icon = item.icon

                  return item.disabled ? (
                    <span
                      key={item.to}
                      aria-disabled="true"
                      title={item.label}
                      className={`sidebar-link opacity-45 pointer-events-none ${
                        isCollapsed
                          ? 'lg:size-12 lg:p-0 lg:justify-center lg:rounded-xl'
                          : ''
                      }`}
                    >
                      <Icon
                        className={`${isCollapsed ? 'size-6' : 'h-4 w-4'}`}
                      />
                      <span className={isCollapsed ? 'lg:hidden' : ''}>
                        {item.label}
                      </span>
                    </span>
                  ) : (
                    <Link
                      key={item.to}
                      to={item.to}
                      title={item.label}
                      className={`sidebar-link ${
                        isCollapsed
                          ? 'lg:size-12 lg:p-0 lg:justify-center lg:rounded-xl'
                          : ''
                      }`}
                      activeProps={{
                        className: `sidebar-link sidebar-link-active ${
                          isCollapsed
                            ? 'lg:after:absolute lg:after:bottom-0.5 lg:after:left-1/2 lg:after:-translate-x-1/2 lg:after:h-1 lg:after:w-1 lg:after:rounded-full lg:after:bg-accent'
                            : ''
                        }`,
                      }}
                    >
                      <Icon
                        className={`${isCollapsed ? 'size-6' : 'h-4 w-4'}`}
                      />
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
              className={`relative overflow-hidden rounded-[1.35rem] border border-border bg-[linear-gradient(180deg,color-mix(in_srgb,var(--panel-elevated)_84%,transparent),color-mix(in_srgb,var(--sidebar)_92%,black))] shadow-[0_18px_48px_rgba(0,0,0,0.18)] ${
                isCollapsed ? 'p-1.5 lg:mx-auto' : 'p-4'
              }`}
            >
              <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-[linear-gradient(90deg,transparent,color-mix(in_srgb,var(--accent)_32%,transparent),transparent)]" />

              <div
                className={`flex items-start ${
                  isCollapsed ? 'flex-col items-center gap-2' : 'gap-3'
                }`}
              >
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto w-auto rounded-2xl p-0 hover:bg-transparent"
                    >
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-[radial-gradient(circle_at_top,color-mix(in_srgb,var(--accent)_24%,transparent),transparent_68%),color-mix(in_srgb,var(--surface-muted)_82%,var(--panel))] text-sm font-semibold tracking-[0.16em] text-foreground">
                        {initials}
                      </div>
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

                <div
                  className={`min-w-0 flex-1 pr-1 ${
                    isCollapsed ? 'hidden' : ''
                  }`}
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
