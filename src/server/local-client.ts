import * as expenses from './api/expenses'
import * as gmailSync from './api/gmailSync'

/**
 * Server-side data access for webhooks and scheduled jobs. Gmail/Resend
 * handlers call the D1 data functions directly instead of going over HTTP.
 */
export const serverApi = {
  expenses: {
    importFromEmail: expenses.importFromEmail,
  },
  gmailSync: {
    getState: gmailSync.getState,
    upsertState: gmailSync.upsertState,
  },
}

type Fn<A, R> = (args: A) => Promise<R>

export function createServerClient() {
  return {
    query: <A, R>(fn: Fn<A, R>, args: A): Promise<R> => fn(args),
    mutation: <A, R>(fn: Fn<A, R>, args: A): Promise<R> => fn(args),
  }
}
