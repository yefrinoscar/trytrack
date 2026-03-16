import { describe, expect, it } from 'vitest'
import {
  formatCurrency,
  getDashboardSummary,
  getDebtProjection,
  getMonthlyIncomeAmount,
} from './finance'
import type { DashboardData, Income } from './finance'

const dashboardFixture: DashboardData = {
  debts: [
    {
      id: 'debt-1',
      name: 'Card',
      lender: 'Bank',
      type: 'Credit card',
      currency: 'USD',
      balance: 500,
      rate: 20,
      payments: 12.5,
      dueDate: '2026-03-20',
      createdAt: '2026-03-01T00:00:00.000Z',
    },
  ],
  incomes: [
    {
      id: 'income-1',
      name: 'Salary',
      source: 'Company',
      amount: 3000,
      frequency: 'Monthly',
      nextDate: '2026-03-31',
      createdAt: '2026-03-01T00:00:00.000Z',
    },
  ],
  investments: [
    {
      id: 'investment-1',
      name: 'ETF',
      account: 'Brokerage',
      type: 'ETF',
      currentValue: 1200,
      monthlyContribution: 100,
      changePct: 5,
      createdAt: '2026-03-01T00:00:00.000Z',
    },
  ],
  goals: [
    {
      id: 'goal-1',
      name: 'Emergency',
      type: 'Emergency',
      target: 2000,
      current: 500,
      deadline: '2026-06-01',
      createdAt: '2026-03-01T00:00:00.000Z',
    },
  ],
  recurringPayments: [],
  settings: {
    currency: 'USD',
    lastUpdated: '2026-03-01T00:00:00.000Z',
  },
}

describe('finance helpers', () => {
  it('converts recurring income into monthly amount', () => {
    const weeklyIncome: Income = {
      id: 'income-weekly',
      name: 'Weekly',
      source: 'Client',
      amount: 500,
      frequency: 'Weekly',
      nextDate: '2026-03-08',
      createdAt: '2026-03-01T00:00:00.000Z',
    }

    expect(getMonthlyIncomeAmount(weeklyIncome)).toBeCloseTo(2166.67, 1)
  })

  it('summarizes dashboard totals', () => {
    const summary = getDashboardSummary(dashboardFixture)

    expect(summary.totalDebt).toBe(500)
    expect(summary.monthlyIncome).toBe(3000)
    expect(summary.totalInvestments).toBe(1200)
    expect(summary.goalProgress).toBe(25)
    expect(summary.freeCash).toBe(2860)
  })

  it('formats currency consistently', () => {
    expect(formatCurrency(1234, 'USD')).toBe('$1,234')
  })

  it('projects debt balance downward over time', () => {
    const projection = getDebtProjection(
      dashboardFixture.debts,
      new Date('2026-03-01'),
    )

    expect(projection[0]?.balance).toBe(500)
    expect(projection.at(-1)?.balance).toBeLessThan(500)
  })
})
