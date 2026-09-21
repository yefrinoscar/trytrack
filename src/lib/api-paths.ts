/**
 * Path map used by the RPC client, e.g. `api.debts.listByUser`. The server
 * dispatcher in `src/server/rpc.server.ts` resolves these strings.
 */
export const api = {
  users: {
    getByEmail: 'users.getByEmail',
    current: 'users.current',
    ensureCurrent: 'users.ensureCurrent',
    create: 'users.create',
    update: 'users.update',
  },
  debts: {
    listByUser: 'debts.listByUser',
    getInstallmentOverview: 'debts.getInstallmentOverview',
    create: 'debts.create',
    update: 'debts.update',
    payNextInstallment: 'debts.payNextInstallment',
    restructureInstallments: 'debts.restructureInstallments',
    payCustomAmount: 'debts.payCustomAmount',
    updateInstallmentAmount: 'debts.updateInstallmentAmount',
    undoLastPayment: 'debts.undoLastPayment',
    remove: 'debts.remove',
  },
  recurringPayments: {
    listByUser: 'recurringPayments.listByUser',
    create: 'recurringPayments.create',
    update: 'recurringPayments.update',
    remove: 'recurringPayments.remove',
  },
  expenses: {
    listByUser: 'expenses.listByUser',
    listByDateRange: 'expenses.listByDateRange',
    create: 'expenses.create',
    update: 'expenses.update',
    remove: 'expenses.remove',
    importFromEmail: 'expenses.importFromEmail',
    listPendingEmailImports: 'expenses.listPendingEmailImports',
    updateEmailImportCategory: 'expenses.updateEmailImportCategory',
    confirmEmailImport: 'expenses.confirmEmailImport',
    dismissEmailImport: 'expenses.dismissEmailImport',
  },
  monthlySpend: {
    getMonthlySpendSummary: 'monthlySpend.getMonthlySpendSummary',
  },
  gmailSync: {
    getState: 'gmailSync.getState',
    upsertState: 'gmailSync.upsertState',
  },
} as const
