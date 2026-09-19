import * as expenses from './api/expenses'
import * as gmailSync from './api/gmailSync'

/**
 * Server-side equivalent of the old Convex client. Gmail/Resend webhooks used
 * `ConvexHttpClient` to reach the backend; now they call the local functions
 * directly.
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
