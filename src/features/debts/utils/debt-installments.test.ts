import { describe, expect, it } from 'vite-plus/test'
import type { Debt } from '@/lib/finance'
import { getDebtPaymentTimeline } from './debt-installments'

const debtFixture: Debt = {
  id: 'debt-1',
  name: 'Phone',
  lender: 'Store',
  type: 'Loan',
  currency: 'USD',
  balance: 0,
  rate: 0,
  payments: 2,
  remainingInstallments: 0,
  dueDate: '2026-05-18',
  originalBalance: 850,
  currentPlanVersion: 1,
  activePlan: null,
  installmentPlans: [
    {
      version: 1,
      principalAtStart: 850,
      installmentsTotal: 2,
      installmentAmount: 425,
      startMonth: '2026-05',
      nextInstallmentNumber: 3,
      status: 'completed',
      createdAt: '2026-05-18T00:00:00.000Z',
      updatedAt: '2026-05-18T00:00:00.000Z',
    },
    {
      version: 1,
      principalAtStart: 850,
      installmentsTotal: 2,
      installmentAmount: 425,
      startMonth: '2026-05',
      nextInstallmentNumber: 3,
      status: 'completed',
      createdAt: '2026-05-18T00:00:00.000Z',
      updatedAt: '2026-05-18T00:00:01.000Z',
    },
  ],
  installmentPayments: [
    {
      id: 'payment-1',
      planVersion: 1,
      installmentNumber: 1,
      amountPaid: 660,
      paidAt: '2026-05-18',
      createdAt: '2026-05-18T00:00:00.000Z',
    },
    {
      id: 'payment-2',
      planVersion: 1,
      installmentNumber: 2,
      amountPaid: 220,
      paidAt: '2026-05-18',
      createdAt: '2026-05-18T00:00:01.000Z',
    },
  ],
  status: 'closed',
  createdAt: '2026-05-18T00:00:00.000Z',
  updatedAt: '2026-05-18T00:00:01.000Z',
}

describe('getDebtPaymentTimeline', () => {
  it('does not duplicate payments when duplicate plan versions exist', () => {
    const timeline = getDebtPaymentTimeline(debtFixture)

    expect(timeline).toHaveLength(2)
    expect(timeline.map((payment) => payment.id)).toEqual([
      'payment-1',
      'payment-2',
    ])
  })
})
