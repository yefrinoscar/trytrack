import { parseMoney } from '@/features/finance/shared'
import type { Debt } from '@/lib/finance'
import type { DebtDraft } from '../types'

export function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    USD: '$',
    PEN: 'S/',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
  }

  return symbols[currency.toUpperCase()] || currency
}

export function formatAmountInputValue(value: string): string {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return ''
  }

  const parsed = Number(trimmedValue)
  return Number.isFinite(parsed) ? parsed.toFixed(2) : trimmedValue
}

export function createEmptyDebtDraft(currency: string): DebtDraft {
  return {
    name: '',
    lender: '',
    type: 'Credit card',
    currency,
    balance: '',
    rate: '0',
    payments: '1',
    dueDate: '',
  }
}

export function debtToDraft(debt: Debt): DebtDraft {
  return {
    name: debt.name,
    lender: debt.lender,
    type: debt.type,
    currency: debt.currency,
    balance: formatAmountInputValue(String(debt.balance)),
    rate: String(debt.rate),
    payments: String(debt.payments ?? 1),
    dueDate: debt.dueDate,
    originalBalance:
      typeof debt.originalBalance === 'number'
        ? formatAmountInputValue(String(debt.originalBalance))
        : undefined,
  }
}

export function draftToDebtValue(
  draft: DebtDraft,
  defaultCurrency: string,
): Omit<Debt, 'id' | 'createdAt'> {
  return {
    name: draft.name.trim(),
    lender: draft.lender.trim() || 'Personal ledger',
    type: draft.type,
    currency: draft.currency.trim().toUpperCase() || defaultCurrency,
    balance: parseMoney(draft.balance),
    rate: parseMoney(draft.rate),
    payments: Math.max(1, Math.round(parseMoney(draft.payments) || 1)),
    dueDate: draft.dueDate || new Date().toISOString().slice(0, 10),
  }
}

export function normalizeDebtDraftForUpdate(
  draft: DebtDraft,
  debt: Debt,
): DebtDraft {
  const normalizedDraft = { ...draft }

  if (!normalizedDraft.name.trim()) {
    normalizedDraft.name = debt.name
  }

  if (!normalizedDraft.lender.trim()) {
    normalizedDraft.lender = debt.lender
  }

  if (!normalizedDraft.currency.trim()) {
    normalizedDraft.currency = debt.currency
  }

  if (!normalizedDraft.balance.trim()) {
    normalizedDraft.balance = String(debt.balance)
  }

  if (!normalizedDraft.payments.trim()) {
    normalizedDraft.payments = String(debt.payments)
  }

  if (!normalizedDraft.dueDate.trim()) {
    normalizedDraft.dueDate = debt.dueDate
  }

  return normalizedDraft
}

export function hasDebtDraftChanged(
  draft: DebtDraft,
  debt: Debt,
  defaultCurrency: string,
): boolean {
  const currentValue = draftToDebtValue(debtToDraft(debt), defaultCurrency)
  const nextValue = draftToDebtValue(draft, defaultCurrency)

  return JSON.stringify(currentValue) !== JSON.stringify(nextValue)
}
