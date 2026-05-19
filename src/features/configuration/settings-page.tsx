import type { ReactNode } from 'react'
import { MoonStar, Sparkles, SunMedium, WalletCards } from 'lucide-react'
import { Select } from '@/components/ui/select'
import { FinancePageState } from '@/features/finance/shared'
import type { FinanceActions } from '@/features/finance/shared'
import { AVAILABLE_CURRENCIES } from '@/lib/finance'
import { formatCurrency } from '@/lib/finance'
import type { DashboardData } from '@/lib/finance'
import { cn } from '@/lib/utils'

export function SettingsPage() {
  return (
    <FinancePageState>
      {(data, actions) => <SettingsView actions={actions} data={data} />}
    </FinancePageState>
  )
}

function SettingsView({
  data,
  actions,
}: {
  data: DashboardData
  actions: FinanceActions
}) {
  const previewAmount = data.debts[0]?.balance ?? 12850.45

  return (
    <main className="page-wrap px-4 pb-16">
      <section className="border-b border-border pb-8 pt-2">
        <div className="mt-3">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-[2.7rem]">
            Configuration
          </h1>
        </div>
      </section>

      <section className="divide-y divide-border">
        <SettingsSection
          description="Choose how the workspace should look."
          label="Theme"
        >
          <div className="space-y-3">
            <SelectionOption
              active={data.settings.theme === 'light'}
              description="Soft surfaces and brighter contrast for daytime use."
              disabled={actions.isWorking}
              icon={SunMedium}
              onClick={() => void actions.updateSettings({ theme: 'light' })}
              title="Light"
            />
            <SelectionOption
              active={data.settings.theme === 'dark'}
              description="A quieter, cinematic desk for focused sessions."
              disabled={actions.isWorking}
              icon={MoonStar}
              onClick={() => void actions.updateSettings({ theme: 'dark' })}
              title="Dark"
            />
          </div>
        </SettingsSection>

        <SettingsSection
          description="Changes formatting only. Stored values stay the same."
          label="Currency"
        >
          <div className="flex max-w-xl flex-col gap-4">
            <div className="space-y-2">
              <span className="text-sm font-medium text-foreground">
                Enabled currencies
              </span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {AVAILABLE_CURRENCIES.map((currencyCode) => {
                  const enabled =
                    data.settings.enabledCurrencies.includes(currencyCode)
                  return (
                    <button
                      key={currencyCode}
                      type="button"
                      disabled={
                        actions.isWorking ||
                        (enabled &&
                          data.settings.enabledCurrencies.length <= 1 &&
                          data.settings.currency === currencyCode)
                      }
                      className={cn(
                        'rounded-lg border px-3 py-2 text-sm font-medium transition disabled:pointer-events-none disabled:opacity-50',
                        enabled
                          ? 'border-border-strong bg-popover text-foreground'
                          : 'border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                      onClick={() => {
                        const current = data.settings.enabledCurrencies
                        const next = enabled
                          ? current.filter((value) => value !== currencyCode)
                          : [...current, currencyCode]

                        void actions.updateSettings({
                          enabledCurrencies: next,
                          ...(enabled &&
                          data.settings.currency === currencyCode &&
                          next.length
                            ? { currency: next[0] }
                            : {}),
                        })
                      }}
                    >
                      {currencyCode}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <label className="flex min-w-[220px] flex-1 flex-col gap-2">
                <span className="text-sm font-medium text-foreground">
                  Display currency
                </span>
                <Select
                  id="currency"
                  disabled={actions.isWorking}
                  value={data.settings.currency}
                  onChange={(event) =>
                    void actions.updateSettings({
                      currency: event.target.value,
                    })
                  }
                >
                  {data.settings.enabledCurrencies.map((currencyCode) => (
                    <option key={currencyCode} value={currencyCode}>
                      {currencyCode}
                    </option>
                  ))}
                </Select>
              </label>

              <div className="min-w-[180px] rounded-2xl border border-border bg-muted px-4 py-3">
                <p className="eyebrow text-muted-foreground/80">Preview</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  {formatCurrency(previewAmount, data.settings.currency)}
                </p>
              </div>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection
          description="Reduce movement if you want a steadier interface."
          label="Motion"
        >
          <div className="space-y-3">
            <SelectionOption
              active={data.settings.motion === 'full'}
              description="Keeps counters and route transitions expressive."
              disabled={actions.isWorking}
              icon={Sparkles}
              onClick={() => void actions.updateSettings({ motion: 'full' })}
              title="Full motion"
            />
            <SelectionOption
              active={data.settings.motion === 'reduced'}
              description="Minimizes animations for a calmer experience."
              disabled={actions.isWorking}
              icon={WalletCards}
              onClick={() => void actions.updateSettings({ motion: 'reduced' })}
              title="Reduced motion"
            />
          </div>
        </SettingsSection>
      </section>
    </main>
  )
}

function SettingsSection({
  children,
  description,
  label,
}: {
  children: ReactNode
  description: string
  label: string
}) {
  return (
    <section className="grid gap-6 py-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          {label}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>

      <div>{children}</div>
    </section>
  )
}

function SelectionOption({
  active,
  description,
  disabled,
  icon: Icon,
  onClick,
  title,
}: {
  active: boolean
  description: string
  disabled?: boolean
  icon: typeof SunMedium
  onClick: () => void
  title: string
}) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        'flex w-full items-start justify-between gap-4 rounded-2xl border px-4 py-4 text-left transition disabled:pointer-events-none disabled:opacity-60',
        active
          ? 'border-border-strong bg-popover text-foreground'
          : 'border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
      disabled={disabled}
      type="button"
      onClick={onClick}
    >
      <div className="flex items-start gap-4">
        <div className="grid h-11 w-11 place-items-center rounded-2xl border border-border bg-muted text-foreground">
          <Icon className="h-4 w-4" />
        </div>

        <div>
          <div className="flex items-center gap-3">
            <p className="text-sm font-semibold tracking-tight text-foreground">
              {title}
            </p>
            <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground/80">
              {active ? 'Selected' : 'Available'}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
      </div>

      <span
        className={cn(
          'mt-1 h-4 w-4 rounded-full border',
          active
            ? 'border-primary bg-primary shadow-[0_0_0_4px_var(--ring)]'
            : 'border-border-strong bg-transparent',
        )}
      />
    </button>
  )
}
