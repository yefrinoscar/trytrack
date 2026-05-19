import type { Debt, RecurringPaymentStatus } from '@/lib/finance'

export interface DebtDraft {
  name: string
  lender: string
  type: Debt['type']
  currency: string
  balance: string
  rate: string
  payments: string
  dueDate: string
  originalBalance?: string
}

export type DebtDraftField = keyof DebtDraft

export interface RecurringPaymentDraft {
  name: string
  category: string
  currency: string
  amount: string
  dueDay: string
  startDate: string
  status: RecurringPaymentStatus
}

export type RecurringPaymentDraftField = keyof RecurringPaymentDraft
