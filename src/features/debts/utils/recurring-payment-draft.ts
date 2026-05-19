import { parseMoney } from '@/features/finance/shared'
import type { RecurringPayment } from '@/lib/finance'
import type { RecurringPaymentDraft } from '../types'
import { formatAmountInputValue, getCurrencySymbol } from './debt-draft'

export { formatAmountInputValue, getCurrencySymbol }

export function createEmptyRecurringPaymentDraft(
  currency: string,
): RecurringPaymentDraft {
  return {
    name: '',
    category: '',
    currency,
    amount: '',
    dueDay: '1',
    startDate: '',
    status: 'active',
  }
}

export function recurringPaymentToDraft(
  payment: RecurringPayment,
): RecurringPaymentDraft {
  return {
    name: payment.name,
    category: payment.category,
    currency: payment.currency,
    amount: formatAmountInputValue(String(payment.amount)),
    dueDay: String(payment.dueDay),
    startDate: payment.startDate,
    status: payment.status === 'paused' ? 'active' : payment.status,
  }
}

export function draftToRecurringPaymentValue(
  draft: RecurringPaymentDraft,
  defaultCurrency: string,
): Omit<RecurringPayment, 'id' | 'createdAt'> {
  return {
    name: draft.name.trim(),
    category: draft.category.trim() || 'Subscription',
    currency: draft.currency.trim().toUpperCase() || defaultCurrency,
    amount: Math.max(0, parseMoney(draft.amount)),
    dueDay: Math.max(
      1,
      Math.min(31, Math.round(parseMoney(draft.dueDay) || 1)),
    ),
    startDate: draft.startDate || new Date().toISOString().slice(0, 10),
    status: draft.status,
  }
}

export function normalizeRecurringPaymentDraftForUpdate(
  draft: RecurringPaymentDraft,
  payment: RecurringPayment,
): RecurringPaymentDraft {
  const normalizedDraft = { ...draft }

  if (!normalizedDraft.name.trim()) {
    normalizedDraft.name = payment.name
  }

  if (!normalizedDraft.category.trim()) {
    normalizedDraft.category = payment.category
  }

  if (!normalizedDraft.currency.trim()) {
    normalizedDraft.currency = payment.currency
  }

  if (!normalizedDraft.amount.trim()) {
    normalizedDraft.amount = formatAmountInputValue(String(payment.amount))
  }

  if (!normalizedDraft.dueDay.trim()) {
    normalizedDraft.dueDay = String(payment.dueDay)
  }

  if (!normalizedDraft.startDate.trim()) {
    normalizedDraft.startDate = payment.startDate
  }

  return normalizedDraft
}

export function hasRecurringPaymentDraftChanged(
  draft: RecurringPaymentDraft,
  payment: RecurringPayment,
  defaultCurrency: string,
): boolean {
  const currentValue = draftToRecurringPaymentValue(
    recurringPaymentToDraft(payment),
    defaultCurrency,
  )
  const nextValue = draftToRecurringPaymentValue(draft, defaultCurrency)

  return JSON.stringify(currentValue) !== JSON.stringify(nextValue)
}
