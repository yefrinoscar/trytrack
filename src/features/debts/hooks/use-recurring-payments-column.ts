import { useCallback, useState } from 'react'
import type { FinanceActions } from '@/features/finance/shared'
import type { RecurringPayment } from '@/lib/finance'
import type {
  RecurringPaymentDraft,
  RecurringPaymentDraftField,
} from '../types'
import {
  createEmptyRecurringPaymentDraft,
  draftToRecurringPaymentValue,
  hasRecurringPaymentDraftChanged,
  normalizeRecurringPaymentDraftForUpdate,
} from '../utils/recurring-payment-draft'

export function useRecurringPaymentsColumn({
  actions,
  recurringPayments,
  defaultCurrency,
  enabledCurrencies,
}: {
  actions: FinanceActions
  recurringPayments: RecurringPayment[]
  defaultCurrency: string
  enabledCurrencies: string[]
}) {
  const preferredCurrency = enabledCurrencies.includes(defaultCurrency)
    ? defaultCurrency
    : (enabledCurrencies[0] ?? defaultCurrency)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createInitialDraft, setCreateInitialDraft] =
    useState<RecurringPaymentDraft>(() =>
      createEmptyRecurringPaymentDraft(preferredCurrency),
    )

  const editingPayment =
    recurringPayments.find((payment) => payment.id === editingPaymentId) ?? null

  const openCreateForm = useCallback(() => {
    setCreateInitialDraft(createEmptyRecurringPaymentDraft(preferredCurrency))
    setCreateError(null)
    setShowCreateForm(true)
  }, [preferredCurrency])

  const openEditForm = useCallback((paymentId: string) => {
    setEditingPaymentId(paymentId)
  }, [])

  const closeCreateForm = useCallback(() => {
    setCreateError(null)
    setShowCreateForm(false)
  }, [])

  const closeEditForm = useCallback(() => {
    setEditingPaymentId(null)
  }, [])

  const commitEditField = useCallback(
    async (
      _field: RecurringPaymentDraftField,
      _value: string,
      nextDraft: RecurringPaymentDraft,
    ) => {
      if (!editingPayment) {
        return
      }

      const normalizedDraft = normalizeRecurringPaymentDraftForUpdate(
        nextDraft,
        editingPayment,
      )

      if (
        !hasRecurringPaymentDraftChanged(
          normalizedDraft,
          editingPayment,
          defaultCurrency,
        )
      ) {
        return
      }

      await actions.updateRecurringPayment({
        id: editingPayment.id,
        value: draftToRecurringPaymentValue(normalizedDraft, defaultCurrency),
      })
    },
    [actions, defaultCurrency, editingPayment],
  )

  const submitCreatePayment = useCallback(
    async (draft: RecurringPaymentDraft) => {
      const value = draftToRecurringPaymentValue(draft, defaultCurrency)
      const normalizedCurrency = value.currency.toUpperCase()

      if (!enabledCurrencies.includes(normalizedCurrency)) {
        setCreateError(
          'Currency not enabled. Enable it in Configuration first.',
        )
        return
      }

      if (!value.name.trim()) {
        setCreateError('Payment name is required.')
        return
      }

      setCreateError(null)

      try {
        await actions.createRecurringPayment(value)
        closeCreateForm()
      } catch (error) {
        const message = (() => {
          if (error instanceof Error && error.message.trim().length > 0) {
            return error.message
          }
          if (typeof error === 'string' && error.trim().length > 0) {
            return error
          }
          return 'Could not create payment. Please try again.'
        })()

        setCreateError(message)
      }
    },
    [actions, closeCreateForm, defaultCurrency, enabledCurrencies],
  )

  const cancelPayment = useCallback(
    (id: string) => {
      void actions.updateRecurringPayment({
        id,
        value: { status: 'cancelled' },
      })
    },
    [actions],
  )

  const reactivatePayment = useCallback(
    (id: string) => {
      void actions.updateRecurringPayment({
        id,
        value: { status: 'active' },
      })
    },
    [actions],
  )

  const removePayment = useCallback(
    (id: string) => {
      void actions.removeRecurringPayment(id)
    },
    [actions],
  )

  return {
    cancelPayment,
    closeCreateForm,
    closeEditForm,
    commitEditField,
    createError,
    createInitialDraft,
    editingPayment,
    editingPaymentId,
    openCreateForm,
    openEditForm,
    reactivatePayment,
    removePayment,
    showCreateForm,
    submitCreatePayment,
  }
}
