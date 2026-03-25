import { Link } from '@tanstack/react-router'
import {
  CircleDollarSign,
  Landmark,
  Settings2,
  Target,
  TrendingUp,
} from 'lucide-react'
import { BrandLogo } from './brand-logo'

const navItems = [
  { to: '/debts', label: 'Debt', icon: Landmark, disabled: false },
  { to: '/incomes', label: 'Income', icon: CircleDollarSign, disabled: false },
  { to: '/investments', label: 'Invest', icon: TrendingUp, disabled: true },
  { to: '/goals', label: 'Goals', icon: Target, disabled: true },
  { to: '/settings', label: 'Prefs', icon: Settings2, disabled: false },
] as const

export default function Header() {
  return (
    <aside className="border-b border-[var(--border)] pt-16 lg:fixed lg:top-10 lg:left-[max(1rem,calc((100vw-1320px)/2+1rem))] lg:z-10 lg:w-[180px] lg:border-b-0 lg:pt-0">
      <div className="bg-[var(--sidebar)] px-4 pb-4 pt-4 sm:px-5 lg:flex lg:flex-col lg:rounded-lg lg:px-4 lg:pb-5 lg:pt-5">
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
    </aside>
  )
}
