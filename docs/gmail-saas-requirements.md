# Gmail SaaS Requirements

These are the requirements to turn the current personal Gmail expense import into
a service where other users can connect their own Google account.

## Product requirements

- Each user must sign in to the app and connect their own Google account with
  OAuth.
- The app must store Gmail refresh tokens per user, not as one shared owner
  token.
- Imported expenses must always be attached to the authenticated app user.
- Users need a disconnect flow that deletes or disables their Gmail token and
  stops future syncs.
- Users need clear controls for parsed imports: category, count as expense,
  ignored/internal movement, and delete or hide.

## Google requirements

- The Google Cloud OAuth consent screen must be configured for an external app.
- The app needs public terms of service and privacy policy URLs.
- The Gmail scope must be minimized to the least access that works for parsing
  bank notifications.
- If using restricted Gmail scopes in production, Google verification is needed.
  Depending on the scope and risk review, Google can also require a security
  assessment.
- The app must follow Google API Services User Data Policy and Limited Use:
  only use Gmail data for the user-facing expense feature, do not sell the data,
  and do not use it for ads.

## Architecture requirements

- Store OAuth tokens encrypted or in a secrets-backed store.
- Keep a Gmail sync state per user: email, history ID, watch expiration, and last
  sync status.
- Register Gmail Watch per connected user, publishing to one Pub/Sub topic.
- Handle Pub/Sub push notifications through the app webhook.
- Keep a scheduled poll fallback because Gmail Watch can expire, Pub/Sub can be
  misconfigured, and history IDs can become invalid.
- Renew Gmail Watch before expiration. Gmail watches are not permanent.
- Make email parsing strict: only trusted bank senders and expected transaction
  formats should create expenses.
- Log sync failures without logging raw email bodies or secrets.

## Current single-user implementation

- The current app uses one owner Gmail account configured through environment
  variables.
- Gmail Watch and Pub/Sub are available, but the app also needs scheduled polling
  so expenses arrive even when Pub/Sub does not fire.
- Before opening this to other users, the owner-only environment variables must
  become per-user OAuth records in Convex.
