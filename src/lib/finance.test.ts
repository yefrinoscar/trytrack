import { describe, expect, it, vi } from 'vite-plus/test'
import type { DashboardData, Income } from './finance'

vi.mock('@tanstack/react-query', () => ({
  useMutation: vi.fn(),
  useQuery: vi.fn(),
  useQueryClient: vi.fn(),
}))

const {
  formatCurrency,
  getDebtPlannedPayment,
  getDashboardSummary,
  getDebtProjection,
  getMonthlySpendSummary,
  getMonthlyIncomeAmount,
} = await import('./finance')

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
      minimumPayment: 55,
      dueDate: '2026-03-20',
      createdAt: '2026-03-01T00:00:00.000Z',
    },
  ],
  expenses: [
    {
      id: 'expense-1',
      amount: 25,
      currency: 'USD',
      category: 'Food',
      description: 'Lunch',
      spentAt: '2026-03-15',
      createdAt: '2026-03-15T00:00:00.000Z',
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
    enabledCurrencies: ['USD', 'PEN'],
    theme: 'dark',
    motion: 'full',
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
    expect(summary.freeCash).toBe(2845)
  })

  it('formats currency consistently', () => {
    expect(formatCurrency(1234, 'USD')).toBe('$1,234.00')
    expect(formatCurrency(69.9, 'USD')).toBe('$69.90')
  })

  it('projects debt balance downward over time', () => {
    const projection = getDebtProjection(
      dashboardFixture.debts,
      new Date('2026-03-01'),
    )

    expect(projection[0]?.balance).toBe(500)
    expect(projection.at(-1)?.balance).toBeLessThan(500)
  })

  it('prefers target and minimum payments for debt planning', () => {
    expect(getDebtPlannedPayment(dashboardFixture.debts[0]!)).toBe(55)
    expect(
      getDebtPlannedPayment({
        balance: 800,
        payments: 8,
        minimumPayment: 40,
        targetPayment: 100,
      }),
    ).toBe(100)
  })

  it('uses remaining installments for recalculated debt payments', () => {
    expect(
      getDebtPlannedPayment({
        balance: 700,
        payments: 10,
        remainingInstallments: 7,
      }),
    ).toBe(100)
  })

  it('builds a monthly spend summary across debts, recurring, and expenses', () => {
    const summary = getMonthlySpendSummary(
      {
        ...dashboardFixture,
        recurringPayments: [
          {
            id: 'recurring-1',
            name: 'Netflix',
            category: 'Subscription',
            amount: 20,
            currency: 'USD',
            dueDay: 12,
            status: 'active',
            startDate: '2026-01-01',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
      '2026-03',
      'USD',
    )

    expect(summary.plannedDebtPayments).toBe(55)
    expect(summary.plannedRecurringPayments).toBe(20)
    expect(summary.actualExpenses).toBe(25)
    expect(summary.totalMonthlySpend).toBe(100)
    expect(summary.byCurrency[0]?.currency).toBe('USD')
  })
})
