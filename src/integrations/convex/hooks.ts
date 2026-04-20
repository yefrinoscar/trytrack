import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useConvex } from 'convex/react'

import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

/** Signed-in app user row (Convex `users` table), or null if not loaded / no session. */
export function useCurrentAppUser() {
  const convex = useConvex()

  return useQuery({
    queryKey: ['users', 'current'],
    queryFn: () => convex.query(api.users.current, {}),
  })
}

/** @deprecated Prefer {@link useCurrentAppUser}; kept for call sites that still pass email. */
export function useUser(email: string | undefined) {
  const convex = useConvex()

  return useQuery({
    queryKey: ['user', email],
    queryFn: () => convex.query(api.users.getByEmail, { email: email! }),
    enabled: !!email,
  })
}

export function useExpenses(userId: Id<'users'> | undefined) {
  const convex = useConvex()

  return useQuery({
    queryKey: ['expenses', userId],
    queryFn: () => convex.query(api.expenses.listByUser, { userId: userId! }),
    enabled: !!userId,
  })
}

export function useCreateExpense() {
  const convex = useConvex()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: {
      userId: Id<'users'>
      amount: number
      currency: string
      description: string
      category: string
      merchant?: string
      spentAt: string
    }) => convex.mutation(api.expenses.create, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['expenses'] })
    },
  })
}

export function useMonthlySpendSummary(
  userId: Id<'users'> | undefined,
  month: string | undefined,
  currency?: string,
) {
  const convex = useConvex()

  return useQuery({
    queryKey: ['monthly-spend', userId, month, currency],
    queryFn: () =>
      convex.query(api.monthlySpend.getMonthlySpendSummary, {
        userId: userId!,
        month: month!,
        currency,
      }),
    enabled: !!userId && !!month,
  })
}
