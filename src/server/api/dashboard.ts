import { getInstallmentOverviewForUser, listByUser as listDebts } from './debts'
import { listByUser as listExpenses, listPendingEmailImports } from './expenses'
import { listByUser as listRecurring, listChecks } from './recurringPayments'
import { ensureSessionUser } from './users'

/**
 * Everything the dashboard needs, in one round trip.
 *
 * The page used to issue seven sequential calls, each a separate request to
 * the Worker. Now it is one, and all the reads below run in a single parallel
 * batch: D1 lives in another region from the Worker, so every extra round trip
 * costs roughly a quarter of a second.
 */
export async function bootstrap() {
  const appUser = await ensureSessionUser()
  if (!appUser) {
    return null
  }
  const userId = appUser._id
  const month = new Date().toISOString().slice(0, 7)

  const [
    debts,
    installmentOverview,
    expenses,
    recurringPayments,
    emailExpenseImports,
    recurringPaymentChecks,
  ] = await Promise.all([
    listDebts({ userId }),
    getInstallmentOverviewForUser({ userId }),
    listExpenses({ userId }),
    listRecurring({ userId }),
    listPendingEmailImports(),
    listChecks({ userId, month }),
  ])
  return {
    user: appUser,
    debts,
    installmentOverview,
    expenses,
    recurringPayments,
    recurringPaymentChecks,
    emailExpenseImports,
  }
}

export type DashboardBootstrap = NonNullable<
  Awaited<ReturnType<typeof bootstrap>>
>
