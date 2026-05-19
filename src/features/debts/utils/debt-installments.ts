import type { Debt } from '@/lib/finance'

function getLatestPlanPerVersion(debt: Debt) {
  const latestPlanByVersion = new Map<
    number,
    NonNullable<Debt['installmentPlans']>[number]
  >()

  for (const plan of debt.installmentPlans ?? []) {
    const existing = latestPlanByVersion.get(plan.version)
    if (
      !existing ||
      plan.updatedAt > existing.updatedAt ||
      (plan.updatedAt === existing.updatedAt &&
        plan.createdAt >= existing.createdAt)
    ) {
      latestPlanByVersion.set(plan.version, plan)
    }
  }

  return Array.from(latestPlanByVersion.values())
}

function getUniquePayments(debt: Debt) {
  const paymentsById = new Map<
    string,
    NonNullable<Debt['installmentPayments']>[number]
  >()

  for (const payment of debt.installmentPayments ?? []) {
    paymentsById.set(payment.id, payment)
  }

  return Array.from(paymentsById.values())
}

export function getDebtInstallmentState(debt: Debt) {
  const plans = getLatestPlanPerVersion(debt)
  const activePlan =
    debt.activePlan ?? plans.find((plan) => plan.status === 'active') ?? null
  const fallbackTotalInstallments = Math.max(1, Math.round(debt.payments || 1))
  const totalInstallments =
    activePlan?.installmentsTotal ?? fallbackTotalInstallments
  const fallbackRemainingInstallments = Math.max(
    0,
    Math.min(
      totalInstallments,
      Math.round(debt.remainingInstallments ?? totalInstallments),
    ),
  )
  const fallbackPaidCount = Math.max(
    0,
    totalInstallments - fallbackRemainingInstallments,
  )
  const nextInstallmentNumber = Math.min(
    totalInstallments + 1,
    activePlan?.nextInstallmentNumber ?? fallbackPaidCount + 1,
  )
  const planVersion = activePlan?.version ?? debt.currentPlanVersion ?? 1
  const payments = getUniquePayments(debt)
    .filter((payment) => payment.planVersion === planVersion)
    .sort(
      (left, right) =>
        left.installmentNumber - right.installmentNumber ||
        left.paidAt.localeCompare(right.paidAt),
    )
  const paidCount = Math.max(fallbackPaidCount, payments.length)
  const remainingInstallments = Math.max(0, totalInstallments - paidCount)

  return {
    activePlan,
    totalDebt: debt.originalBalance ?? debt.balance,
    totalInstallments,
    paidCount,
    remainingInstallments,
    nextInstallmentNumber,
  }
}

export function getDebtPlanHistory(debt: Debt) {
  const payments = getUniquePayments(debt)

  return getLatestPlanPerVersion(debt)
    .slice()
    .sort((left, right) => left.version - right.version)
    .map((plan) => ({
      ...plan,
      payments: payments
        .filter((payment) => payment.planVersion === plan.version)
        .sort(
          (left, right) =>
            left.installmentNumber - right.installmentNumber ||
            left.paidAt.localeCompare(right.paidAt),
        ),
    }))
}

export function getDebtPaymentTimeline(debt: Debt) {
  return getDebtPlanHistory(debt)
    .flatMap((plan) =>
      plan.payments.map((payment) => ({
        ...payment,
        planVersion: plan.version,
      })),
    )
    .sort(
      (left, right) =>
        left.planVersion - right.planVersion ||
        left.installmentNumber - right.installmentNumber ||
        left.paidAt.localeCompare(right.paidAt),
    )
}
