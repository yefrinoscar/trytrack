import { getInstallmentOverview, listByUser as listDebts } from './debts'
import { listByUser as listExpenses, listPendingEmailImports } from './expenses'
import { listChecks } from './recurringPayments'
import { listByUser as listRecurring } from './recurringPayments'
import { ensureSessionUser } from './users'

/**
 * Everything the dashboard needs, in one round trip.
 *
 * The page used to issue seven sequential calls, each a separate request to
 * the Worker, which added up to seconds of waiting. Gathering them here means
 * one request, and the independent reads run in parallel.
 */
export async function bootstrap() {
  const appUser = await ensureSessionUser()
  if (!appUser) {
    return null
  }

  const userId = appUser._id

  // Debts first: the installment overview needs their ids.
  const debts = await listDebts({ userId })

  const [
    installmentOverview,
    expenses,
    recurringPayments,
    emailExpenseImports,
    recurringPaymentChecks,
  ] = await Promise.all([
    debts.length
      ? getInstallmentOverview({
          debtIds: (debts as Array<{ _id: string }>).map((debt) => debt._id),
        })
      : Promise.resolve([]),
    listExpenses({ userId }),
    listRecurring({ userId }),
    listPendingEmailImports(),
    listChecks({ userId, month: new Date().toISOString().slice(0, 7) }),
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
