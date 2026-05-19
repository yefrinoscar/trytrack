# Improvements

## Daily Expense Email Import

Start with email forwarding, then add direct mailbox connections later.

### Phase 1: Forwarded Receipts

Create an inbound email address for the app, for example `expenses@trytrack.app`.
Users forward receipt or bank notification emails to that address. The inbound
email provider sends the parsed email payload to our backend webhook, where we
extract amount, currency, merchant, date, and category.

Recommended behavior:

- Save imported expenses as pending review before counting them as confirmed.
- Store the original sender, subject, received date, and raw snippet for audit.
- Deduplicate emails by provider message id and normalized transaction fields.
- Show parsing errors in the app instead of silently dropping emails.

Possible providers:

- Resend inbound email
- Postmark inbound email
- Mailgun routes
- SendGrid inbound parse

### Phase 2: Gmail/Outlook Connection

Add OAuth-based mailbox connections after the forwarding flow works well.
Users connect Gmail or Outlook with read-only permissions. The app scans only
new emails from allowed senders or matching payment keywords, then creates the
same pending expense records used by Phase 1.

This is more automatic but requires stronger privacy controls, OAuth token
storage, provider setup, and possibly Google app verification.
