#!/usr/bin/env node
/**
 * One-off migration: imports a `npx convex export` snapshot into the local
 * (or remote) D1/SQLite database.
 *
 *   node scripts/migrate-convex-export.mjs /tmp/convex-unzip [--db local.db]
 *
 * Pass `--out sql` to only write drizzle/seed.sql instead of touching a DB.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import Database from 'better-sqlite3'

const args = process.argv.slice(2)
const exportDir = args[0]
const outIndex = args.indexOf('--out')
const outMode = outIndex !== -1 ? args[outIndex + 1] : null
const dbIndex = args.indexOf('--db')
const dbPath = dbIndex !== -1 ? args[dbIndex + 1] : 'local.db'

if (!exportDir || !existsSync(exportDir)) {
  console.error(
    'Usage: node scripts/migrate-convex-export.mjs <export-dir> [--db local.db|--out sql]',
  )
  process.exit(1)
}

function readDocuments(dir) {
  const file = join(dir, 'documents.jsonl')
  if (!existsSync(file)) {
    return []
  }
  return readFileSync(file, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

/** Maps a Convex document onto drizzle snake_case columns. */
function mapRow(doc, map) {
  const row = {}
  for (const [target, source] of Object.entries(map)) {
    const raw = typeof source === 'function' ? source(doc) : doc[source]
    row[target] = raw === undefined ? null : raw
  }
  return row
}

const tables = [
  {
    name: 'users',
    dir: 'users',
    map: {
      id: '_id',
      email: 'email',
      name: (d) => d.name ?? null,
      currency: (d) => d.currency ?? null,
      created_at: (d) => Math.round(d.createdAt ?? d._creationTime),
      updated_at: (d) => Math.round(d.updatedAt ?? d._creationTime),
    },
  },
  {
    name: 'debts',
    dir: 'debts',
    map: {
      id: '_id',
      user_id: 'userId',
      name: 'name',
      lender: 'lender',
      type: 'type',
      currency: 'currency',
      balance: 'balance',
      rate: 'rate',
      payments: (d) => Math.round(d.payments),
      payment_mode: (d) => d.paymentMode ?? null,
      remaining_installments: (d) =>
        d.remainingInstallments === undefined
          ? null
          : Math.round(d.remainingInstallments),
      minimum_payment: (d) => d.minimumPayment ?? null,
      target_payment: (d) => d.targetPayment ?? null,
      due_day: (d) => (d.dueDay === undefined ? null : Math.round(d.dueDay)),
      due_date: 'dueDate',
      original_balance: (d) => d.originalBalance ?? null,
      current_plan_version: (d) =>
        d.currentPlanVersion === undefined
          ? null
          : Math.round(d.currentPlanVersion),
      status: 'status',
      created_at: (d) => Math.round(d.createdAt ?? d._creationTime),
      updated_at: (d) => Math.round(d.updatedAt ?? d._creationTime),
    },
  },
  {
    name: 'debt_plans',
    dir: 'debtPlans',
    map: {
      id: '_id',
      debt_id: 'debtId',
      version: (d) => Math.round(d.version),
      principal_at_start: 'principalAtStart',
      installments_total: (d) => Math.round(d.installmentsTotal),
      installment_amount: 'installmentAmount',
      start_month: 'startMonth',
      next_installment_number: (d) => Math.round(d.nextInstallmentNumber),
      status: 'status',
      created_at: (d) => Math.round(d.createdAt ?? d._creationTime),
      updated_at: (d) => Math.round(d.updatedAt ?? d._creationTime),
    },
  },
  {
    name: 'debt_payments',
    dir: 'debtPayments',
    map: {
      id: '_id',
      debt_id: 'debtId',
      plan_version: (d) => Math.round(d.planVersion),
      installment_number: (d) => Math.round(d.installmentNumber),
      amount_paid: 'amountPaid',
      paid_at: 'paidAt',
      request_id: (d) => d.requestId ?? d._id,
      created_at: (d) => Math.round(d.createdAt ?? d._creationTime),
    },
  },
  {
    name: 'recurring_payments',
    dir: 'recurringPayments',
    map: {
      id: '_id',
      user_id: 'userId',
      name: 'name',
      category: 'category',
      currency: 'currency',
      amount: 'amount',
      cadence: (d) => d.cadence ?? 'monthly',
      due_day: (d) => Math.round(d.dueDay),
      start_date: 'startDate',
      end_date: (d) => d.endDate ?? null,
      status: 'status',
      created_at: (d) => Math.round(d.createdAt ?? d._creationTime),
      updated_at: (d) => Math.round(d.updatedAt ?? d._creationTime),
    },
  },
  {
    name: 'expenses',
    dir: 'expenses',
    map: {
      id: '_id',
      user_id: 'userId',
      amount: 'amount',
      currency: 'currency',
      category: 'category',
      description: 'description',
      merchant: (d) => d.merchant ?? null,
      spent_at: 'spentAt',
      created_at: (d) => Math.round(d.createdAt ?? d._creationTime),
      updated_at: (d) => Math.round(d.updatedAt ?? d._creationTime),
    },
  },
  {
    name: 'email_expense_imports',
    dir: 'emailExpenseImports',
    map: {
      id: '_id',
      user_id: (d) => d.userId ?? null,
      user_email: 'userEmail',
      provider: 'provider',
      email_id: 'emailId',
      message_id: (d) => d.messageId ?? null,
      from_address: (d) => d.from ?? null,
      to_addresses: (d) => JSON.stringify(d.to ?? []),
      subject: (d) => d.subject ?? null,
      text_snippet: (d) => d.textSnippet ?? null,
      html_snippet: (d) => d.htmlSnippet ?? null,
      merchant: (d) => d.merchant ?? null,
      amount: (d) => d.amount ?? null,
      currency: (d) => d.currency ?? null,
      spent_at: (d) => d.spentAt ?? null,
      occurred_at: (d) => d.occurredAt ?? null,
      source: (d) => d.source ?? null,
      category: (d) => d.category ?? null,
      dedupe_key: (d) => d.dedupeKey ?? null,
      status: 'status',
      error: (d) => d.error ?? null,
      confirmed_expense_id: (d) => d.confirmedExpenseId ?? null,
      created_at: (d) => Math.round(d.createdAt ?? d._creationTime),
      updated_at: (d) => Math.round(d.updatedAt ?? d._creationTime),
    },
  },
  {
    name: 'gmail_sync_states',
    dir: 'gmailSyncStates',
    map: {
      id: '_id',
      user_email: (d) => String(d.userEmail).toLowerCase(),
      history_id: (d) => d.historyId ?? null,
      watch_expiration: (d) =>
        d.watchExpiration === undefined ? null : Math.round(d.watchExpiration),
      created_at: (d) => Math.round(d.createdAt ?? d._creationTime),
      updated_at: (d) => Math.round(d.updatedAt ?? d._creationTime),
    },
  },
]

// Better Auth is stored in the `betterAuth` component; the local schema is
// flattened into auth_* tables.
const authTables = [
  {
    name: 'auth_user',
    dir: '_components/betterAuth/user',
    map: {
      id: '_id',
      name: (d) => d.name ?? '',
      email: 'email',
      email_verified: (d) => (d.emailVerified ? 1 : 0),
      image: (d) => d.image ?? null,
      created_at: (d) => Math.round((d.createdAt ?? d._creationTime) / 1000),
      updated_at: (d) => Math.round((d.updatedAt ?? d._creationTime) / 1000),
    },
  },
  {
    name: 'auth_session',
    dir: '_components/betterAuth/session',
    map: {
      id: '_id',
      expires_at: (d) => Math.round(d.expiresAt / 1000),
      token: 'token',
      created_at: (d) => Math.round((d.createdAt ?? d._creationTime) / 1000),
      updated_at: (d) => Math.round(d.updatedAt ?? d._creationTime / 1000),
      ip_address: (d) => d.ipAddress ?? null,
      user_agent: (d) => d.userAgent ?? null,
      user_id: 'userId',
    },
  },
  {
    name: 'auth_account',
    dir: '_components/betterAuth/account',
    map: {
      id: '_id',
      account_id: 'accountId',
      provider_id: 'providerId',
      user_id: 'userId',
      access_token: (d) => d.accessToken ?? null,
      refresh_token: (d) => d.refreshToken ?? null,
      id_token: (d) => d.idToken ?? null,
      access_token_expires_at: (d) =>
        d.accessTokenExpiresAt
          ? Math.round(d.accessTokenExpiresAt / 1000)
          : null,
      refresh_token_expires_at: (d) =>
        d.refreshTokenExpiresAt
          ? Math.round(d.refreshTokenExpiresAt / 1000)
          : null,
      scope: (d) => d.scope ?? null,
      password: (d) => d.password ?? null,
      created_at: (d) => Math.round((d.createdAt ?? d._creationTime) / 1000),
      updated_at: (d) => Math.round((d.updatedAt ?? d._creationTime) / 1000),
    },
  },
  {
    name: 'auth_verification',
    dir: '_components/betterAuth/verification',
    map: {
      id: '_id',
      identifier: 'identifier',
      value: 'value',
      expires_at: (d) => Math.round(d.expiresAt / 1000),
      created_at: (d) => (d.createdAt ? Math.round(d.createdAt / 1000) : null),
      updated_at: (d) => (d.updatedAt ? Math.round(d.updatedAt / 1000) : null),
    },
  },
]

function buildStatements() {
  const statements = []
  for (const table of [...tables, ...authTables]) {
    const documents = readDocuments(join(exportDir, table.dir))
    for (const doc of documents) {
      const row = mapRow(doc, table.map)
      const columns = Object.keys(row)
      const placeholders = columns.map(() => '?').join(', ')
      const sql = `INSERT OR REPLACE INTO ${table.name} (${columns.join(', ')}) VALUES (${placeholders})`
      const values = columns.map((column) => {
        const value = row[column]
        return typeof value === 'boolean' ? (value ? 1 : 0) : value
      })
      statements.push({ table: table.name, sql, values })
    }
  }
  return statements
}

const statements = buildStatements()
const summary = statements.reduce((acc, statement) => {
  acc[statement.table] = (acc[statement.table] ?? 0) + 1
  return acc
}, {})

if (outMode === 'sql') {
  const lines = ['PRAGMA foreign_keys=OFF;', 'BEGIN TRANSACTION;']
  for (const statement of statements) {
    const values = statement.values
      .map((value) =>
        value === null
          ? 'NULL'
          : typeof value === 'number'
            ? String(value)
            : `'${String(value).replace(/'/g, "''")}'`,
      )
      .join(', ')
    lines.push(statement.sql.replace('?', values))
  }
  lines.push('COMMIT;', 'PRAGMA foreign_keys=ON;')
  writeFileSync('drizzle/seed.sql', lines.join('\n'))
  console.log('Wrote drizzle/seed.sql (parameter placeholders preserved)')
} else {
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  const insert = (statement) =>
    db.prepare(statement.sql).run(...statement.values)
  const runAll = db.transaction((list) => {
    for (const statement of list) {
      insert(statement)
    }
  })
  runAll(statements)
  db.close()
  console.log(`Imported into ${dbPath}`)
}

console.log(JSON.stringify(summary, null, 2))
