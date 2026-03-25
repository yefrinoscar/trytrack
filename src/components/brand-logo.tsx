import { cn } from '@/lib/utils'

export function BrandLogo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-3', className)}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-strong)] bg-[linear-gradient(180deg,#171717_0%,#0b0b0b_100%)] shadow-[0_10px_30px_rgba(0,0,0,0.28)]">
        <img alt="" aria-hidden="true" className="h-6 w-6" src="/favicon.svg" />
      </span>
      <span className="text-lg font-semibold tracking-tight text-[var(--foreground)]">
        Trytracker
      </span>
    </span>
  )
}
