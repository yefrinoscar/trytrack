import { Link } from '@tanstack/react-router'
import {
  CircleDollarSign,
  Landmark,
  LayoutDashboard,
  Settings2,
  Target,
  TrendingUp,
} from 'lucide-react'

const navItems = [
  { to: '/', label: 'Home', icon: LayoutDashboard },
  { to: '/debts', label: 'Debt', icon: Landmark },
  { to: '/incomes', label: 'Income', icon: CircleDollarSign },
  { to: '/investments', label: 'Invest', icon: TrendingUp },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/settings', label: 'Prefs', icon: Settings2 },
] as const

export default function Header() {
  return (
    <aside className="border-b border-[var(--border)] lg:sticky lg:top-0 lg:self-start lg:flex lg:min-h-screen lg:flex-col pt-16 lg:border-b-0">
      <div className="px-4 pb-4 pt-4 sm:px-5 lg:px-4 lg:pb-5 lg:pt-5 bg-[var(--sidebar)] rounded-lg">
        <div className="flex items-center justify-between gap-3 lg:block">
          <Link
            to="/"
            activeOptions={{ exact: true }}
            className="inline-flex w-fit items-center text-lg font-semibold tracking-tight text-[var(--foreground)] no-underline"
          >
            spends
          </Link>
        </div>

        <nav className="mt-4 overflow-x-auto lg:mt-8 lg:overflow-visible">
          <div className="flex min-w-max gap-1.5 lg:flex-col lg:min-w-0">
            {navItems.map((item) => {
              const Icon = item.icon

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  activeOptions={item.to === '/' ? { exact: true } : undefined}
                  className="sidebar-link"
                  activeProps={{ className: 'sidebar-link sidebar-link-active' }}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
        </nav>
      </div>
    </aside>
  )
}
