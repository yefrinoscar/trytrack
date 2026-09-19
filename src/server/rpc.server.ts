import * as debts from './api/debts'
import * as expenses from './api/expenses'
import * as gmailSync from './api/gmailSync'
import * as monthlySpend from './api/monthlySpend'
import * as recurringPayments from './api/recurringPayments'
import * as users from './api/users'

type Handler = (args: any) => Promise<unknown>

const handlers: Record<string, Handler> = {
  'users.getByEmail': users.getByEmail,
  'users.current': users.current,
  'users.ensureCurrent': users.ensureCurrent,
  'users.create': users.create,
  'users.update': users.update,

  'debts.listByUser': debts.listByUser,
  'debts.getInstallmentOverview': debts.getInstallmentOverview,
  'debts.create': debts.create,
  'debts.update': debts.update,
  'debts.payNextInstallment': debts.payNextInstallment,
  'debts.restructureInstallments': debts.restructureInstallments,
  'debts.payCustomAmount': debts.payCustomAmount,
  'debts.updateInstallmentAmount': debts.updateInstallmentAmount,
  'debts.undoLastPayment': debts.undoLastPayment,
  'debts.remove': debts.remove,

  'recurringPayments.listByUser': recurringPayments.listByUser,
  'recurringPayments.create': recurringPayments.create,
  'recurringPayments.update': recurringPayments.update,
  'recurringPayments.remove': recurringPayments.remove,

  'expenses.listByUser': expenses.listByUser,
  'expenses.listByDateRange': expenses.listByDateRange,
  'expenses.create': expenses.create,
  'expenses.update': expenses.update,
  'expenses.remove': expenses.remove,
  'expenses.importFromEmail': expenses.importFromEmail,
  'expenses.listPendingEmailImports': expenses.listPendingEmailImports,
  'expenses.updateEmailImportCategory': expenses.updateEmailImportCategory,
  'expenses.confirmEmailImport': expenses.confirmEmailImport,
  'expenses.dismissEmailImport': expenses.dismissEmailImport,

  'monthlySpend.getMonthlySpendSummary': monthlySpend.getMonthlySpendSummary,

  'gmailSync.getState': gmailSync.getState,
  'gmailSync.upsertState': gmailSync.upsertState,
}

export type RpcInput = {
  path: string
  args: Record<string, unknown> | undefined
}

export async function runRpc(input: RpcInput): Promise<unknown> {
  const handler = handlers[input.path]
  if (!handler) {
    throw new Error(`Unknown API function: ${input.path}`)
  }
  return await handler(input.args ?? {})
}
