import { cn } from '@/lib/utils'

export function BrandLogo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-3 whitespace-nowrap',
        className,
      )}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-border-strong bg-[linear-gradient(180deg,var(--panel),var(--sidebar))] shadow-sm">
        <img alt="" aria-hidden="true" className="h-6 w-6" src="/favicon.svg" />
      </span>
      <span className="text-lg font-semibold tracking-tight text-foreground">
        Trytracker
      </span>
    </span>
  )
}
