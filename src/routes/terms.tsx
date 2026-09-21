import { createFileRoute } from '@tanstack/react-router'
import { LegalPage, LegalSection } from '@/features/legal/legal-layout'

const LAST_UPDATED = 'September 20, 2026'
const CONTACT_EMAIL = 'yefrioscar9814@gmail.com'
const APP_URL = 'https://trytrack.underlabs.dev'

export const Route = createFileRoute('/terms')({
  head: () => ({
    meta: [
      { title: 'Terms of Service · Trytracker' },
      {
        name: 'description',
        content:
          'The terms that govern your use of Trytracker, the personal finance tracker.',
      },
    ],
  }),
  component: TermsPage,
})

function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updatedAt={LAST_UPDATED}>
      <LegalSection title="Acceptance of these terms">
        <p>
          By creating an account or using Trytracker you agree to these terms.
          If you do not agree, please do not use the application.
        </p>
      </LegalSection>

      <LegalSection title="What Trytracker is">
        <p>
          Trytracker is a personal finance tracking tool that helps you organise
          debts, installment plans, recurring payments, goals and expenses, and
          optionally import expense notifications from your email.
        </p>
      </LegalSection>

      <LegalSection title="Not financial advice">
        <p>
          Trytracker is an organisational tool only. It does not provide
          financial, investment, tax or legal advice. Calculations such as
          installment schedules, projections and summaries are estimates based
          on the data you enter. Always verify important figures with your bank
          or a qualified professional before making decisions.
        </p>
      </LegalSection>

      <LegalSection title="Your account">
        <p>
          You are responsible for the accuracy of the information you enter, for
          keeping your password confidential, and for all activity under your
          account. You must be at least 13 years old to use the service.
        </p>
      </LegalSection>

      <LegalSection title="Email import and third-party services">
        <p>
          If you connect a Gmail account, you authorise us to read bank
          notification emails on your behalf to create expense entries. You can
          disconnect at any time from Settings, which stops future imports.
        </p>
        <p>
          Email parsing may fail or misread a message. Imported items are always
          presented for your review before they count as expenses; you are
          responsible for checking and correcting them. Your use of Google
          services is also governed by Google's own terms.
        </p>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>You agree not to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Use the service for unlawful purposes.</li>
          <li>
            Attempt to access data belonging to other accounts or interfere with
            the service's operation.
          </li>
          <li>Connect an email account you are not authorised to access.</li>
          <li>
            Reverse engineer, resell or redistribute the service without
            permission.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Availability and changes">
        <p>
          The service is provided on an "as is" and "as available" basis. We may
          modify, suspend or discontinue features at any time, and we do not
          guarantee uninterrupted availability or freedom from errors.
        </p>
      </LegalSection>

      <LegalSection title="Limitation of liability">
        <p>
          To the maximum extent permitted by law, Trytracker is not liable for
          any indirect, incidental or consequential damages, or for any loss of
          data, profits or financial opportunity arising from your use of the
          service.
        </p>
      </LegalSection>

      <LegalSection title="Termination">
        <p>
          You may stop using the service and request deletion of your account at
          any time. We may suspend or terminate access if these terms are
          violated.
        </p>
      </LegalSection>

      <LegalSection title="Privacy">
        <p>
          How we handle your information, including data read from Gmail, is
          described in our Privacy Policy, which forms part of these terms.
        </p>
      </LegalSection>

      <LegalSection title="Changes to these terms">
        <p>
          We may update these terms as the service evolves. Continued use after
          a change means you accept the updated terms. The "Last updated" date
          above reflects the latest revision.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions about these terms:{' '}
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
