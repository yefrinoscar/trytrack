import { drizzle as drizzleD1 } from 'drizzle-orm/d1'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import { schema } from './schema'

export type Db = DrizzleD1Database<typeof schema>

type CloudflareEnv = { DB?: unknown }

function getCloudflareDb(): Db | null {
  const env = (globalThis as { __env__?: CloudflareEnv }).__env__
  const binding = env?.DB
  if (!binding) {
    return null
  }
  return drizzleD1(binding as Parameters<typeof drizzleD1>[0], { schema })
}

/**
 * Node-only driver lookup. The module name is built at runtime and resolved via
 * `createRequire` so bundlers cannot statically pull `better-sqlite3` (a native
 * addon) into the Cloudflare Workers bundle. This branch is never reached in
 * production: `getCloudflareDb()` wins whenever the D1 binding is present.
 */
async function loadNodeDriver() {
  const nodeModule = await import('node:module')
  const require = nodeModule.createRequire(import.meta.url)
  return {
    drizzle: require('drizzle-orm/better-sqlite3')
      .drizzle as typeof import('drizzle-orm/better-sqlite3').drizzle,
    Database: require('better-sqlite3') as new (path: string) => {
      pragma: (value: string) => void
    },
  }
}

let nodeDbPromise: Promise<Db> | undefined

/** Local Node fallback (used by `vp dev`, tests and scripts). */
async function getNodeDb(): Promise<Db> {
  if (!nodeDbPromise) {
    nodeDbPromise = (async () => {
      const { drizzle: drizzleSqlite, Database } = await loadNodeDriver()
      const db = new Database(process.env.LOCAL_DB_PATH ?? 'local.db')
      db.pragma('journal_mode = WAL')
      db.pragma('foreign_keys = ON')
      const nodeDb = drizzleSqlite(db as never, { schema })
      return nodeDb as unknown as Db
    })()
  }
  return nodeDbPromise
}

export function isCloudflareRuntime() {
  return Boolean((globalThis as { __env__?: CloudflareEnv }).__env__?.DB)
}

export async function getDb(): Promise<Db> {
  return getCloudflareDb() ?? (await getNodeDb())
}
