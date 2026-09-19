# Architecture

Trytracker runs entirely on Cloudflare Workers. There is no external backend.

- **App**: TanStack Start (React 19) + TanStack Router/Query, Tailwind + shadcn.
- **Runtime**: Cloudflare Workers via Nitro's `cloudflare_module` preset.
- **Database**: Cloudflare D1 (SQLite) through Drizzle ORM.
- **Auth**: Better Auth with the Drizzle adapter, running in the Worker.
- **Email imports**: Gmail/Resend webhooks write directly to D1.

## Request flow

```
Browser ──► Worker (Nitro)
             ├── /login, /debts …      SSR React routes
             ├── /api/auth/*           Better Auth handler (D1)
             ├── /api/email/*          Gmail + Resend inbound webhooks
             └── /_serverFn/<id>       TanStack server function (RPC)
                                        └── src/server/api/*.ts ──► D1
```

Client data access goes through `useApi()` in `src/lib/api-client.ts`, which
posts `{ path, args }` to the RPC server function. `src/server/rpc.server.ts`
maps those paths onto `src/server/api/*.ts`. The path strings live in
`src/lib/api-paths.ts` (`api.debts.listByUser`, …).

## Database

`src/server/db/schema.ts` defines the tables:

| Table                                  | Purpose                                                   |
| -------------------------------------- | --------------------------------------------------------- |
| `users`                                | App profile per Better Auth account (currency, name)      |
| `debts`, `debt_plans`, `debt_payments` | Debts and installment history                             |
| `recurring_payments`                   | Monthly recurring charges                                 |
| `expenses`                             | Confirmed spending                                        |
| `email_expense_imports`                | Parsed email receipts awaiting review                     |
| `gmail_sync_states`                    | Gmail history id + watch expiration                       |
| `auth_*`                               | Better Auth tables (user, session, account, verification) |

`getDb()` (`src/server/db/client.ts`) resolves the D1 binding on Cloudflare via
`globalThis.__env__.DB`, and falls back to a local `better-sqlite3` file
(`LOCAL_DB_PATH`, default `local.db`) for `vp dev`, tests and scripts. The Node
driver is loaded with `createRequire` so it never gets bundled into the Worker.

### Migrations

```bash
vp run db:generate        # drizzle-kit generate + copy into migrations/
vp run db:migrate:local   # apply to the local D1 (wrangler dev state)
vp run db:migrate:remote  # apply to production D1
```

## Environment

Set these on the Worker (`wrangler secret put NAME`) and locally in `.env.local`:

| Variable                              | Required | Notes                                             |
| ------------------------------------- | -------- | ------------------------------------------------- |
| `BETTER_AUTH_SECRET`                  | yes      | 32+ random chars (`openssl rand -base64 32`)      |
| `SITE_URL`                            | yes      | Public URL, e.g. `https://trytrack.underlabs.dev` |
| `TRUSTED_ORIGINS`                     | no       | Comma-separated extra allowed origins             |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | no       | Password reset emails                             |
| `GMAIL_*`, `OWNER_EMAIL`              | no       | Gmail expense import                              |

The D1 binding is declared once in `vite.config.ts` under
`nitro({ cloudflare: { wrangler: { d1_databases: [...] } } })` as `DB`.

## History

This project previously used Convex for the database, functions and auth. It now
runs on Cloudflare D1 + Drizzle + Better Auth, starting from an empty database.
