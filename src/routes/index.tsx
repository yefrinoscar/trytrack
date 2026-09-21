import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ArrowRight,
  BellRing,
  ChartLine,
  CheckCircle2,
  CreditCard,
  Lock,
  Mail,
  ShieldCheck,
  Wallet,
} from 'lucide-react'
import { BrandLogo } from '@/components/brand-logo'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const APP_NAME = 'Trytracker'
const APP_URL = 'https://trytrack.underlabs.dev'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: `${APP_NAME} · Personal finance tracker` },
      {
        name: 'description',
        content: `${APP_NAME} is a personal finance tracker for debts, installment plans, recurring payments and expenses. Optionally import expense notifications from Gmail for review.`,
      },
      {
        property: 'og:title',
        content: `${APP_NAME} · Personal finance tracker`,
      },
      {
        property: 'og:description',
        content:
          'Track debts, installment plans, recurring payments and expenses. Import bank notifications from Gmail for review.',
      },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: APP_URL },
      { property: 'og:image', content: `${APP_URL}/credit-cards.png` },
    ],
  }),
  component: LandingPage,
})

const FEATURES = [
  {
    icon: CreditCard,
    title: 'Debts and installment plans',
    body: 'Track balances, interest, due dates and payment schedules. Restructure a plan or pay a custom amount, and keep the full payment history.',
  },
  {
    icon: BellRing,
    title: 'Recurring payments',
    body: 'Record monthly charges like rent or subscriptions so they are counted in your monthly spend before they are actually paid.',
  },
  {
    icon: Mail,
    title: 'Email expense import',
    body: 'Connect a Gmail account and bank notifications become pending expenses automatically, ready for you to review and categorise.',
  },
  {
    icon: ChartLine,
    title: 'Monthly overview',
    body: 'See planned debt payments, recurring charges and real expenses together, per month and per currency.',
  },
  {
    icon: Wallet,
    title: 'Multi-currency',
    body: 'Keep debts and expenses in different currencies and switch the display currency without altering the stored values.',
  },
  {
    icon: Lock,
    title: 'Private by default',
    body: 'Each account can only access its own records. Gmail access is read-only, limited to bank notifications, and removable at any time.',
  },
]

const STEPS = [
  {
    title: 'Create your account',
    body: 'Sign up with an email address and password. No bank connection is required to start.',
  },
  {
    title: 'Add what you owe and pay',
    body: 'Enter your debts, installment plans and recurring charges. Expense totals build up as you record spending.',
  },
  {
    title: 'Optionally connect Gmail',
    body: 'Read-only access lets bank notification emails create pending expenses. Nothing is confirmed without your review.',
  },
]

function LandingPage() {
  return (
    <div className="bg-background flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <Hero />
        <TrustBar />
        <Features />
        <HowItWorks />
        <GmailSection />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  )
}

function Header() {
  return (
    <header className="border-border/70 sticky top-0 z-20 border-b backdrop-blur">
      <div className="page-wrap flex items-center justify-between px-4 py-4">
        <BrandLogo />
        <nav className="flex items-center gap-2 sm:gap-4">
          <a
            className="text-muted-foreground hover:text-foreground hidden text-sm transition-colors sm:inline"
            href="#features"
          >
            Features
          </a>
          <a
            className="text-muted-foreground hover:text-foreground hidden text-sm transition-colors sm:inline"
            href="#how"
          >
            How it works
          </a>
          <Button asChild size="sm" variant="ghost">
            <Link search={{ redirect: '/debts' }} to="/login">
              Sign in
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link search={{ redirect: '/debts' }} to="/login">
              Get started
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  )
}

function Hero() {
  return (
    <section className="page-wrap px-4 pt-16 pb-14 sm:pt-24 sm:pb-20">
      <div className="mx-auto max-w-3xl text-center">
        <span className="border-border bg-panel text-muted-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
          <ShieldCheck className="h-3.5 w-3.5" />
          Your data stays yours
        </span>
        <h1 className="text-foreground mt-6 text-4xl font-semibold tracking-tight sm:text-6xl">
          Know exactly where your money goes
        </h1>
        <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-base leading-relaxed sm:text-lg">
          {APP_NAME} is a personal finance tracker for debts, installment plans,
          recurring payments and day-to-day expenses. Optionally connect Gmail
          so bank notifications become expenses you simply review.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link search={{ redirect: '/debts' }} to="/login">
              Create your account
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href="#features">See what it does</a>
          </Button>
        </div>
        <p className="text-foreground-faint mt-4 text-xs">
          Free to use · No bank credentials required
        </p>
      </div>
    </section>
  )
}

function TrustBar() {
  const items = [
    'Debts & installments',
    'Recurring payments',
    'Gmail expense import',
    'Multi-currency',
  ]
  return (
    <section className="border-border/70 border-y">
      <div className="page-wrap flex flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 py-5">
        {items.map((item) => (
          <span
            key={item}
            className="text-muted-foreground flex items-center gap-2 text-xs uppercase tracking-[0.12em]"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {item}
          </span>
        ))}
      </div>
    </section>
  )
}

function SectionHeading({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string
  title: string
  body?: string
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-foreground-faint text-xs uppercase tracking-[0.14em]">
        {eyebrow}
      </p>
      <h2 className="text-foreground mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
        {title}
      </h2>
      {body ? (
        <p className="text-muted-foreground mt-4 text-base leading-relaxed">
          {body}
        </p>
      ) : null}
    </div>
  )
}

function Features() {
  return (
    <section className="page-wrap px-4 py-16 sm:py-24" id="features">
      <SectionHeading
        body={`Everything ${APP_NAME} does, built around the way debts and monthly spending actually work.`}
        eyebrow="Features"
        title="One place for your monthly money"
      />
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <article
            key={feature.title}
            className="border-border bg-panel rounded-[1.25rem] border p-6"
          >
            <span className="border-border-strong bg-panel-elevated flex h-10 w-10 items-center justify-center rounded-xl border">
              <feature.icon className="text-foreground h-5 w-5" />
            </span>
            <h3 className="text-foreground mt-4 text-base font-semibold">
              {feature.title}
            </h3>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              {feature.body}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}

function HowItWorks() {
  return (
    <section className="border-border/70 border-y" id="how">
      <div className="page-wrap px-4 py-16 sm:py-24">
        <SectionHeading
          eyebrow="How it works"
          title="Up and running in three steps"
        />
        <ol className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="border-border bg-panel rounded-[1.25rem] border p-6"
            >
              <span className="bg-primary text-primary-foreground inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold">
                {index + 1}
              </span>
              <h3 className="text-foreground mt-4 text-base font-semibold">
                {step.title}
              </h3>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function GmailSection() {
  const points = [
    'Read-only access, so nothing in your mailbox can be changed or deleted.',
    'Only bank notification emails from known senders are processed.',
    'Every import arrives as a pending expense you review before it counts.',
    'Disconnect from Settings at any time, which deletes the stored token.',
  ]

  return (
    <section className="page-wrap px-4 py-16 sm:py-24">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <div>
          <p className="text-foreground-faint text-xs uppercase tracking-[0.14em]">
            Email import
          </p>
          <h2 className="text-foreground mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Stop typing expenses by hand
          </h2>
          <p className="text-muted-foreground mt-4 text-base leading-relaxed">
            If you use Yape, BBVA, BCP or similar, your bank already emails you
            after every payment. {APP_NAME} can read those notifications and
            turn them into expenses for review.
          </p>
          <ul className="mt-6 space-y-3">
            {points.map((point) => (
              <li key={point} className="flex gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span className="text-muted-foreground text-sm leading-relaxed">
                  {point}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-border bg-panel rounded-[1.25rem] border p-6">
          <p className="text-foreground-faint text-xs uppercase tracking-[0.12em]">
            Example import
          </p>
          <div className="border-border mt-4 space-y-3">
            <div className="border-border bg-panel-elevated rounded-xl border p-4">
              <p className="text-muted-foreground text-xs">
                From: notificaciones@yape.pe
              </p>
              <p className="text-foreground mt-1 text-sm">
                Pagaste S/ 30.00 a Jesus Ram*
              </p>
            </div>
            <div className="text-foreground-faint flex items-center gap-2 text-xs">
              <ArrowRight className="h-3.5 w-3.5" />
              becomes a pending expense
            </div>
            <div className="border-border bg-panel-elevated rounded-xl border p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-foreground text-sm font-medium">
                  Jesus Ram*
                </span>
                <span className="text-foreground text-sm tabular-nums">
                  PEN 30.00
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="border-border text-muted-foreground rounded-md border px-2 py-0.5 text-xs">
                  Transport
                </span>
                <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-xs text-amber-500">
                  Pending review
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Faq() {
  const questions = [
    {
      q: 'Does it need my bank password?',
      a: 'No. You either enter your debts and expenses manually, or connect an email account so bank notifications are read. Bank credentials are never requested.',
    },
    {
      q: 'What does it read from my Gmail?',
      a: 'Only bank notification emails matching a list of known senders and payment keywords. Other messages are not processed or stored. Access is read-only.',
    },
    {
      q: 'Can I disconnect Gmail later?',
      a: 'Yes. Settings has a Disconnect action that deletes the stored token and stops future imports immediately.',
    },
    {
      q: 'Are imported expenses added automatically?',
      a: 'No. They arrive as pending items so a parsing mistake never becomes real spending. You confirm, categorise or dismiss each one.',
    },
  ]

  return (
    <section className="border-border/70 border-t">
      <div className="page-wrap px-4 py-16 sm:py-24">
        <SectionHeading eyebrow="FAQ" title="Common questions" />
        <div className="mx-auto mt-10 grid max-w-3xl gap-4">
          {questions.map((item) => (
            <div
              key={item.q}
              className="border-border bg-panel rounded-[1.25rem] border p-6"
            >
              <h3 className="text-foreground text-base font-semibold">
                {item.q}
              </h3>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                {item.a}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function FinalCta() {
  return (
    <section className="border-border/70 border-y">
      <div className="page-wrap px-4 py-16 sm:py-20">
        <div
          className={cn(
            'border-border bg-panel mx-auto max-w-3xl rounded-[1.5rem] border p-10 text-center',
          )}
        >
          <h2 className="text-foreground text-2xl font-semibold tracking-tight sm:text-3xl">
            Start tracking in a few minutes
          </h2>
          <p className="text-muted-foreground mx-auto mt-3 max-w-xl text-sm leading-relaxed">
            Create an account, add your first debt, and see your monthly spend
            come together.
          </p>
          <Button asChild className="mt-7" size="lg">
            <Link search={{ redirect: '/debts' }} to="/login">
              Create your account
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

function SiteFooter() {
  return (
    <footer className="border-border/70 border-t">
      <div className="page-wrap flex flex-col gap-6 px-4 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-sm">
          <BrandLogo />
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
            A personal finance tracker for debts, installment plans, recurring
            payments and expenses.
          </p>
        </div>
        <nav className="flex flex-col gap-3 text-sm sm:flex-row sm:gap-10">
          <div className="flex flex-col gap-2">
            <span className="text-foreground-faint text-xs uppercase tracking-[0.12em]">
              Product
            </span>
            <a
              className="text-muted-foreground hover:text-foreground transition-colors"
              href="#features"
            >
              Features
            </a>
            <a
              className="text-muted-foreground hover:text-foreground transition-colors"
              href="#how"
            >
              How it works
            </a>
            <Link
              className="text-muted-foreground hover:text-foreground transition-colors"
              search={{ redirect: '/debts' }}
              to="/login"
            >
              Sign in
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-foreground-faint text-xs uppercase tracking-[0.12em]">
              Legal
            </span>
            <Link
              className="text-muted-foreground hover:text-foreground transition-colors"
              to="/privacy"
            >
              Privacy Policy
            </Link>
            <Link
              className="text-muted-foreground hover:text-foreground transition-colors"
              to="/terms"
            >
              Terms of Service
            </Link>
          </div>
        </nav>
      </div>
      <div className="border-border/70 border-t">
        <div className="page-wrap text-foreground-faint flex flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs">
          <span>
            © {new Date().getFullYear()} {APP_NAME}
          </span>
          <span>{APP_URL.replace('https://', '')}</span>
        </div>
      </div>
    </footer>
  )
}
