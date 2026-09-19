# Debt Installment Rules

## Goal

Support debt installment payments with:

- sequential monthly payments,
- exact payment date and amount per installment,
- plan recalculation without losing history,
- concurrency-safe writes in D1 (single SQL statement per step, `requestId` idempotency).

## Data Model

### `debts`

Current debt snapshot used by the UI and summaries.

- `balance`: remaining debt right now
- `originalBalance`: original debt amount when the debt was created
- `payments`: total installments in the active plan
- `remainingInstallments`: remaining installments in the active plan
- `currentPlanVersion`: active plan version
- `dueDate`: next due date
- `dueDay`: preferred monthly due day
- `status`: `active | closed`

### `debtPlans`

Versioned installment plans for each debt.

- `debtId`
- `version`
- `principalAtStart`
- `installmentsTotal`
- `installmentAmount`
- `startMonth` (`YYYY-MM`)
- `nextInstallmentNumber`
- `status`: `active | restructured | completed`

### `debtPayments`

Immutable payment ledger.

- `debtId`
- `planVersion`
- `installmentNumber`
- `amountPaid`
- `paidAt`
- `requestId`

## Main Rules

### 1. Payments are sequential

Only the next installment can be paid.

- If the active plan says `nextInstallmentNumber = 4`, only installment `#4` can be paid.
- Installments are not paid out of order.

### 2. Each payment stores its own date

Every paid installment stores:

- exact installment number,
- exact amount paid,
- exact payment date (`paidAt`).

This makes it possible to answer questions like:

- "When was installment 2 paid?"
- "How much was paid in installment 3?"

### 3. Recalculation creates a new plan version

If a debt is recalculated after some installments were already paid:

- old payments stay untouched in history,
- current plan is marked as `restructured`,
- a new plan version is created for the remaining balance,
- the new plan starts the next month.

The old plan is never rewritten.

### 4. The new plan starts next month

When the user recalculates installments, the replacement plan starts on the next month using the same due day.

### 5. Debt closes automatically

When the last active installment is paid and balance reaches `0`, the debt becomes `closed`.

## Example

Debt created:

- original balance: `1000`
- plan v1: `10` installments

Payments recorded:

- v1 / installment 1 / `100` / `2026-03-10`
- v1 / installment 2 / `100` / `2026-04-10`
- v1 / installment 3 / `100` / `2026-05-10`

Remaining balance becomes `700`.

Then the user recalculates the remaining balance into `10` new installments.

Result:

- plan v1 becomes `restructured`
- plan v2 is created with:
  - `principalAtStart = 700`
  - `installmentsTotal = 10`
  - `startMonth = next month`
- payment history for v1 remains visible forever

## Concurrency Rules

### Idempotency

Every payment mutation includes `requestId`.

- If the same request is retried, the existing payment is reused.
- This protects against double click and retry duplication.

### One transaction per payment

Each installment payment is processed in one server call
(`debts.payNextInstallment` in `src/server/api/debts.ts`):

1. validate debt and active plan,
2. validate next installment number,
3. insert `debtPayments` row,
4. update `debtPlans.nextInstallmentNumber`,
5. update `debts.balance`, `remainingInstallments`, `dueDate`, and `status`.

Because this is transactional, concurrent writes stay consistent.

### No historical rewrites

Paid installments are never edited or deleted as part of normal flow.

Plan changes only create new versions.

## UI Rules

Each debt card should show:

- total debt (`originalBalance`)
- current debt (`balance`)
- paid installments count
- current schedule
- payment history grouped by plan version

Paid installments should show:

- installment number
- amount paid
- payment date

## Migration / Legacy Debt Behavior

Older debts that existed before installment history was introduced may not have plan/payment rows yet.

In that case:

- the app creates or derives a fallback active plan,
- future payments use the new model,
- missing historical dates are not invented.
