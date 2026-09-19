# Trytracker

Personal finance tracker for debts, recurring payments and email-imported
expenses. Runs entirely on Cloudflare Workers with a D1 (SQLite) database.

- **App**: TanStack Start + Router + Query (React 19), Tailwind + shadcn
- **Database**: Cloudflare D1 via Drizzle ORM
- **Auth**: Better Auth (email + password), D1-backed
- **Hosting**: Cloudflare Workers (`trytrack`), Nitro `cloudflare_module` preset

See [docs/architecture.md](docs/architecture.md) for how the pieces fit together.

## Getting started

```bash
vp install
cp .env.example .env.local   # set BETTER_AUTH_SECRET and SITE_URL
vp run db:migrate:local      # create the local D1 schema
vp dev --port 3000
```

`vp dev` uses a local SQLite file when the D1 binding is absent. Set
`LOCAL_DB_PATH` to use a different file.

## Commands

```bash
vp dev --port 3000      # dev server
vp build                # production build (Cloudflare Worker)
vp test                 # unit + data-layer integration tests
vp check                # format, lint and type check
vp check --fix          # apply formatting/lint fixes
vp run deploy:worker    # deploy with wrangler
```

Database:

```bash
vp run db:generate       # drizzle-kit generate + copy into migrations/
vp run db:migrate:local  # apply migrations to local D1
vp run db:migrate:remote # apply migrations to production D1
```

## Deploying

```bash
vp build
vp run db:migrate:remote
vp run deploy:worker
```

Set the Worker secrets before deploying:

```bash
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put SITE_URL           # e.g. https://trytrack.underlabs.dev
```

The D1 binding (`DB`) is declared in `vite.config.ts` and generated into
`.output/server/wrangler.json` at build time.

## Project layout

```
src/routes/          file-based routes (pages + /api handlers)
src/server/api/      D1 data functions (debts, expenses, users, …)
src/server/db/       Drizzle schema, client, helpers
src/server/auth.ts   Better Auth setup
src/lib/finance.ts   dashboard query/mutation hooks
migrations/          D1 migrations (wrangler)
scripts/             one-off tools (Gmail import, Convex export import)
```

## Historical note

This app previously used Convex for its database, functions and auth. It was
migrated to D1 + Drizzle + standalone Better Auth.
`scripts/migrate-convex-export.mjs` can import an old `npx convex export`
snapshot into D1.
