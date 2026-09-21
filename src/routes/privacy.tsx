import { createFileRoute } from '@tanstack/react-router'
import { LegalPage, LegalSection } from '@/features/legal/legal-layout'

const LAST_UPDATED = 'September 20, 2026'
const CONTACT_EMAIL = 'yefrioscar9814@gmail.com'
const APP_URL = 'https://trytrack.underlabs.dev'

export const Route = createFileRoute('/privacy')({
  head: () => ({
    meta: [
      { title: 'Privacy Policy · Trytracker' },
      {
        name: 'description',
        content:
          'How Trytracker collects, uses and protects your data, including email imports from Gmail.',
      },
    ],
  }),
  component: PrivacyPage,
})

function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updatedAt={LAST_UPDATED}>
      <LegalSection title="Overview">
        <p>
          Trytracker is a personal finance tracker that helps you keep track of
          debts, recurring payments and expenses. This policy explains what data
          the app collects, how it is used and the choices you have.
        </p>
        <p>
          By creating an account you agree to the handling of your information
          as described here.
        </p>
      </LegalSection>

      <LegalSection title="Information we collect">
        <p>
          <strong className="text-foreground">Account information.</strong> Your
          email address and, optionally, your name. Passwords are stored only as
          a one-way hash and are never readable by us.
        </p>
        <p>
          <strong className="text-foreground">Financial data you enter.</strong>{' '}
          The debts, installment plans, payments, recurring charges, goals and
          expenses you create in the app.
        </p>
        <p>
          <strong className="text-foreground">Email import data.</strong> If you
          connect a Gmail account, we read only bank notification emails that
          match a list of known senders and payment keywords. From those
          messages we extract the amount, currency, merchant, date and a short
          text snippet. Messages that do not match are not processed or stored.
        </p>
      </LegalSection>

      <LegalSection title="How we use Gmail data">
        <p>
          Trytracker's use of information received from Google APIs adheres to
          the{' '}
          <a
            className="text-foreground underline"
            href="https://developers.google.com/terms/api-services-user-data-policy"
            rel="noreferrer"
            target="_blank"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>
        <p>In practice, this means:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            We request read-only access to Gmail, and only to detect expense
            notifications.
          </li>
          <li>
            Gmail data is used exclusively to create expense entries for you to
            review in the app.
          </li>
          <li>
            We do not sell your data, and we do not use it for advertising.
          </li>
          <li>
            We do not allow humans to read your email content, except when you
            explicitly ask for support, or where required by law.
          </li>
          <li>We do not use Gmail data to train machine learning models.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Where your data is stored">
        <p>
          Data is stored on Cloudflare infrastructure, in a Cloudflare D1
          database tied to the application region. Gmail access tokens are
          stored server-side and are never exposed to the browser.
        </p>
      </LegalSection>

      <LegalSection title="Sharing">
        <p>
          We do not sell or rent your personal data. Data is shared only with:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-foreground">Cloudflare</strong>, which hosts
            the application and database.
          </li>
          <li>
            <strong className="text-foreground">Resend</strong>, used to send
            password reset emails.
          </li>
          <li>
            <strong className="text-foreground">Google</strong>, when you
            connect a Gmail account for expense imports.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Your choices and controls">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-foreground">Disconnect Gmail</strong> at any
            time from Settings. This deletes the stored token and stops future
            imports.
          </li>
          <li>
            <strong className="text-foreground">
              Review or delete imports
            </strong>{' '}
            before they count as expenses. Nothing is confirmed automatically.
          </li>
          <li>
            <strong className="text-foreground">Delete your data</strong> by
            removing records in the app, or by requesting account deletion at
            the contact email below.
          </li>
          <li>
            You can also revoke Google access directly from your{' '}
            <a
              className="text-foreground underline"
              href="https://myaccount.google.com/permissions"
              rel="noreferrer"
              target="_blank"
            >
              Google Account permissions
            </a>
            .
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Data retention">
        <p>
          Your data is kept while your account is active. When you disconnect
          Gmail we delete the stored token immediately. When you delete your
          account we remove your account and its associated financial records,
          except where retention is required by law.
        </p>
      </LegalSection>

      <LegalSection title="Security">
        <p>
          We use HTTPS for all traffic, hash passwords, keep access tokens
          server-side, and restrict access so that each account can only read
          and modify its own records. No system is perfectly secure, so we
          cannot guarantee absolute security.
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>
          Trytracker is not intended for children under 13, and we do not
          knowingly collect data from them.
        </p>
      </LegalSection>

      <LegalSection title="Changes to this policy">
        <p>
          We may update this policy as the app evolves. Material changes will be
          reflected in the "Last updated" date above.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions or requests about your data:{' '}
          <a
            className="text-foreground underline"
            href={`mailto:${CONTACT_EMAIL}`}
          >
            {CONTACT_EMAIL}
          </a>
        </p>
        <p>
          Application: <span className="text-foreground">{APP_URL}</span>
        </p>
      </LegalSection>
    </LegalPage>
  )
}
