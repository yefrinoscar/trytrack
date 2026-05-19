import { useCallback, useMemo, useState } from 'react'
import type { FinanceActions } from '@/features/finance/shared'
import { parseMoney } from '@/features/finance/shared'
import type { Debt } from '@/lib/finance'
import type { DebtDraft, DebtDraftField } from '../types'
import {
  createEmptyDebtDraft,
  draftToDebtValue,
  hasDebtDraftChanged,
  normalizeDebtDraftForUpdate,
} from '../utils/debt-draft'
import { getDebtInstallmentState } from '../utils/debt-installments'

export function useDebtsListColumn({
  actions,
  debts,
  defaultCurrency,
  enabledCurrencies,
}: {
  actions: FinanceActions
  debts: Debt[]
  defaultCurrency: string
  enabledCurrencies: string[]
}) {
  const preferredCurrency = enabledCurrencies.includes(defaultCurrency)
    ? defaultCurrency
    : (enabledCurrencies[0] ?? defaultCurrency)
  const [showCreateDebt, setShowCreateDebt] = useState(false)
  const [editingDebtId, setEditingDebtId] = useState<string | null>(null)
  const [createDebtError, setCreateDebtError] = useState<string | null>(null)
  const [paymentActionError, setPaymentActionError] = useState<string | null>(
    null,
  )
  const [createInitialDraft, setCreateInitialDraft] = useState<DebtDraft>(() =>
    createEmptyDebtDraft(preferredCurrency),
  )

  const debtScope = useMemo(
    () =>
      [...debts].sort((left, right) => {
        const leftClosed = left.status === 'closed' || left.balance <= 0
        const rightClosed = right.status === 'closed' || right.balance <= 0

        if (leftClosed !== rightClosed) {
          return leftClosed ? 1 : -1
        }

        return (
          +new Date(`${left.dueDate}T00:00:00`) -
          +new Date(`${right.dueDate}T00:00:00`)
        )
      }),
    [debts],
  )

  const editingDebt = debts.find((debt) => debt.id === editingDebtId) ?? null

  const openCreateDebtForm = useCallback(() => {
    setCreateInitialDraft(createEmptyDebtDraft(preferredCurrency))
    setCreateDebtError(null)
    setShowCreateDebt(true)
  }, [preferredCurrency])

  const openEditDebtForm = useCallback((debtId: string) => {
    setPaymentActionError(null)
    setEditingDebtId(debtId)
  }, [])

  const closeCreateDebtForm = useCallback(() => {
    setCreateDebtError(null)
    setShowCreateDebt(false)
  }, [])

  const closeEditDebtForm = useCallback(() => {
    setPaymentActionError(null)
    setEditingDebtId(null)
  }, [])

  const removeDebt = useCallback(
    (debtId: string) => {
      void actions.removeItem({
        kind: 'debts',
        id: debtId,
      })
    },
    [actions],
  )

  const payNextInstallment = useCallback(
    async (debtId: string, expectedInstallmentNumber: number) => {
      setPaymentActionError(null)
      try {
        await actions.payDebtInstallment({ debtId, expectedInstallmentNumber })
      } catch (error) {
        setPaymentActionError(getErrorMessage(error))
      }
    },
    [actions],
  )

  const undoDebtPayment = useCallback(
    async (debtId: string, paymentId: string) => {
      setPaymentActionError(null)
      try {
        await actions.undoDebtPayment({ debtId, paymentId })
      } catch (error) {
        setPaymentActionError(getErrorMessage(error))
      }
    },
    [actions],
  )

  const setInstallmentAmount = useCallback(
    async (
      debtId: string,
      amount: number,
      expectedInstallmentNumber: number,
    ) => {
      setPaymentActionError(null)
      try {
        await actions.payCustomAmount({
          debtId,
          amountPaid: amount,
          expectedInstallmentNumber,
        })
      } catch (error) {
        setPaymentActionError(getErrorMessage(error))
      }
    },
    [actions],
  )

  const commitEditField = useCallback(
    async (field: DebtDraftField, _value: string, nextDraft: DebtDraft) => {
      if (!editingDebt) {
        return
      }

      const normalizedDraft = normalizeDebtDraftForUpdate(
        nextDraft,
        editingDebt,
      )

      if (!hasDebtDraftChanged(normalizedDraft, editingDebt, defaultCurrency)) {
        return
      }

      const currentPlanState = getDebtInstallmentState(editingDebt)
      const nextPayments = Math.max(
        1,
        Math.round(parseMoney(normalizedDraft.payments) || 1),
      )

      if (
        field === 'payments' &&
        nextPayments !== currentPlanState.totalInstallments &&
        currentPlanState.paidCount > 0
      ) {
        await actions.restructureDebtInstallments({
          debtId: editingDebt.id,
          payments: nextPayments,
        })
        return
      }

      await actions.updateDebt({
        id: editingDebt.id,
        value: {
          ...editingDebt,
          ...draftToDebtValue(normalizedDraft, defaultCurrency),
        },
      })
    },
    [actions, defaultCurrency, editingDebt],
  )

  const submitCreateDebt = useCallback(
    async (draft: DebtDraft) => {
      const validationError = validateCreateDebtDraft(
        draft,
        defaultCurrency,
        enabledCurrencies,
      )

      if (validationError) {
        setCreateDebtError(validationError)
        return
      }

      const value = draftToDebtValue(draft, defaultCurrency)

      setCreateDebtError(null)

      closeCreateDebtForm()

      void actions.createItem({ kind: 'debts', value }).catch((error) => {
        setCreateInitialDraft(draft)
        setCreateDebtError(getErrorMessage(error))
        setShowCreateDebt(true)
      })
    },
    [actions, closeCreateDebtForm, defaultCurrency, enabledCurrencies],
  )

  return {
    closeCreateDebtForm,
    closeEditDebtForm,
    commitEditField,
    createInitialDraft,
    debtScope,
    editingDebt,
    editingDebtId,
    openCreateDebtForm,
    openEditDebtForm,
    payNextInstallment,
    undoDebtPayment,
    setInstallmentAmount,
    removeDebt,
    paymentActionError,
    showCreateDebt,
    createDebtError,
    submitCreateDebt,
  }
}

function validateCreateDebtDraft(
  draft: DebtDraft,
  defaultCurrency: string,
  enabledCurrencies: string[],
) {
  const normalizedCurrency = (
    draft.currency.trim() || defaultCurrency
  ).toUpperCase()

  if (!draft.name.trim()) {
    return 'Debt name is required.'
  }

  if (parseMoney(draft.balance) <= 0) {
    return 'Debt amount must be greater than 0.'
  }

  if (!enabledCurrencies.includes(normalizedCurrency)) {
    return 'Currency not enabled. Enable it in Configuration first.'
  }

  return null
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return error
  }

  return 'Could not update this payment. Please try again.'
}
