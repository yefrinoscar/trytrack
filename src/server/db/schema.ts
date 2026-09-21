import { sql } from 'drizzle-orm'
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

/**
 * D1 (SQLite) schema. Table/column names are snake_case and JS property names
 * are camelCase, matching the shape the app's client code expects.
 */

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    name: text('name'),
    currency: text('currency'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('users_by_email').on(table.email),
    index('users_by_created_at').on(table.createdAt),
  ],
)

export const debts = sqliteTable(
  'debts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    lender: text('lender').notNull(),
    type: text('type').notNull(),
    currency: text('currency').notNull(),
    balance: real('balance').notNull(),
    rate: real('rate').notNull(),
    payments: integer('payments').notNull(),
    paymentMode: text('payment_mode'),
    remainingInstallments: integer('remaining_installments'),
    minimumPayment: real('minimum_payment'),
    targetPayment: real('target_payment'),
    dueDay: integer('due_day'),
    dueDate: text('due_date').notNull(),
    originalBalance: real('original_balance'),
    currentPlanVersion: integer('current_plan_version'),
    status: text('status').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('debts_by_user_id').on(table.userId),
    index('debts_by_user_id_and_status').on(table.userId, table.status),
    index('debts_by_user_id_and_due_date').on(table.userId, table.dueDate),
  ],
)

export const debtPlans = sqliteTable(
  'debt_plans',
  {
    id: text('id').primaryKey(),
    debtId: text('debt_id').notNull(),
    version: integer('version').notNull(),
    principalAtStart: real('principal_at_start').notNull(),
    installmentsTotal: integer('installments_total').notNull(),
    installmentAmount: real('installment_amount').notNull(),
    startMonth: text('start_month').notNull(),
    nextInstallmentNumber: integer('next_installment_number').notNull(),
    status: text('status').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('debt_plans_by_debt_id').on(table.debtId),
    index('debt_plans_by_debt_id_and_version').on(table.debtId, table.version),
    index('debt_plans_by_debt_id_and_status').on(table.debtId, table.status),
  ],
)

export const debtPayments = sqliteTable(
  'debt_payments',
  {
    id: text('id').primaryKey(),
    debtId: text('debt_id').notNull(),
    planVersion: integer('plan_version').notNull(),
    installmentNumber: integer('installment_number').notNull(),
    amountPaid: real('amount_paid').notNull(),
    paidAt: text('paid_at').notNull(),
    requestId: text('request_id').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('debt_payments_by_debt_id').on(table.debtId),
    index('debt_payments_by_request_id').on(table.requestId),
    index('debt_payments_by_debt_id_and_plan_version_and_installment').on(
      table.debtId,
      table.planVersion,
      table.installmentNumber,
    ),
    index('debt_payments_by_debt_id_and_paid_at').on(
      table.debtId,
      table.paidAt,
    ),
  ],
)

export const recurringPayments = sqliteTable(
  'recurring_payments',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    category: text('category').notNull(),
    currency: text('currency').notNull(),
    amount: real('amount').notNull(),
    cadence: text('cadence').notNull(),
    dueDay: integer('due_day').notNull(),
    startDate: text('start_date').notNull(),
    endDate: text('end_date'),
    status: text('status').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('recurring_payments_by_user_id').on(table.userId),
    index('recurring_payments_by_user_id_and_status').on(
      table.userId,
      table.status,
    ),
    index('recurring_payments_by_user_id_and_due_day').on(
      table.userId,
      table.dueDay,
    ),
  ],
)

export const expenses = sqliteTable(
  'expenses',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    amount: real('amount').notNull(),
    currency: text('currency').notNull(),
    category: text('category').notNull(),
    description: text('description').notNull(),
    merchant: text('merchant'),
    spentAt: text('spent_at').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('expenses_by_user_id').on(table.userId),
    index('expenses_by_user_id_and_spent_at').on(table.userId, table.spentAt),
    index('expenses_by_user_id_and_category').on(table.userId, table.category),
  ],
)

export const emailExpenseImports = sqliteTable(
  'email_expense_imports',
  {
    id: text('id').primaryKey(),
    userId: text('user_id'),
    userEmail: text('user_email').notNull(),
    provider: text('provider').notNull(),
    emailId: text('email_id').notNull(),
    messageId: text('message_id'),
    from: text('from_address'),
    to: text('to_addresses', { mode: 'json' }).$type<string[]>().notNull(),
    subject: text('subject'),
    textSnippet: text('text_snippet'),
    htmlSnippet: text('html_snippet'),
    merchant: text('merchant'),
    amount: real('amount'),
    currency: text('currency'),
    spentAt: text('spent_at'),
    occurredAt: text('occurred_at'),
    source: text('source'),
    category: text('category'),
    dedupeKey: text('dedupe_key'),
    status: text('status').notNull(),
    error: text('error'),
    confirmedExpenseId: text('confirmed_expense_id'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('email_imports_by_email_id').on(table.emailId),
    index('email_imports_by_message_id').on(table.messageId),
    index('email_imports_by_dedupe_key').on(table.dedupeKey),
    index('email_imports_by_user_id_and_status').on(table.userId, table.status),
    index('email_imports_by_user_email_and_status').on(
      table.userEmail,
      table.status,
    ),
    index('email_imports_by_user_id_and_created_at').on(
      table.userId,
      table.createdAt,
    ),
  ],
)

export const gmailSyncStates = sqliteTable(
  'gmail_sync_states',
  {
    id: text('id').primaryKey(),
    userEmail: text('user_email').notNull(),
    historyId: text('history_id'),
    watchExpiration: integer('watch_expiration'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('gmail_sync_states_by_user_email').on(table.userEmail),
  ],
)

/**
 * Per-user Gmail OAuth connection created from the "Connect Gmail" button.
 * Tokens are written by the OAuth callback and read by the sync job, so the app
 * no longer depends on a single owner token stored in Worker secrets.
 */
export const gmailConnections = sqliteTable(
  'gmail_connections',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    email: text('email').notNull(),
    refreshToken: text('refresh_token').notNull(),
    scope: text('scope'),
    connectedAt: integer('connected_at').notNull(),
    lastSyncedAt: integer('last_synced_at'),
    lastError: text('last_error'),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('gmail_connections_by_user_id').on(table.userId),
    uniqueIndex('gmail_connections_by_email').on(table.email),
  ],
)

/* --------------------------------------------------------------------------
 * Better Auth tables (standalone, Drizzle adapter, provider: 'sqlite')
 * ------------------------------------------------------------------------ */

export const authUser = sqliteTable('auth_user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  emailVerified: integer('email_verified', { mode: 'boolean' })
    .notNull()
    .default(false),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const authSession = sqliteTable(
  'auth_session',
  {
    id: text('id').primaryKey(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    token: text('token').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => authUser.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('auth_session_by_token').on(table.token),
    index('auth_session_by_user_id').on(table.userId),
  ],
)

export const authAccount = sqliteTable(
  'auth_account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => authUser.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', {
      mode: 'timestamp',
    }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', {
      mode: 'timestamp',
    }),
    scope: text('scope'),
    password: text('password'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [index('auth_account_by_user_id').on(table.userId)],
)

export const authVerification = sqliteTable(
  'auth_verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
  },
  (table) => [index('auth_verification_by_identifier').on(table.identifier)],
)

export const schema = {
  users,
  debts,
  debtPlans,
  debtPayments,
  recurringPayments,
  expenses,
  emailExpenseImports,
  gmailSyncStates,
  gmailConnections,
  authUser,
  authSession,
  authAccount,
  authVerification,
}

export const nowMs = sql`(unixepoch() * 1000)`
