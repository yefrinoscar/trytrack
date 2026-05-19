# Split `src/lib/finance.ts` into 5 Domain Modules

## Goal

Break 1,897-line monolith into focused modules. Zero import changes for 24 consumers.

## New Files (5)

1. `src/lib/finance-types.ts` (~315 lines) — types, constants, seed data, normalizeCurrencyCode
2. `src/lib/finance-data.ts` (~300 lines) — localStorage, Convex bridge
3. `src/lib/finance-logic.ts` (~335 lines) — business computations
4. `src/lib/finance-formatters.ts` (~110 lines) — formatCurrency, formatDate, etc.
5. `src/lib/finance-hooks.ts` (~500 lines) — useFinanceDashboard, useFinanceActions

## Modified

`src/lib/finance.ts` → barrel (~30 lines) re-exporting all symbols from the 5 modules above.

## Implementation Order: 1,2,3,4,5,6 (barrel last)

## Verification: vp check, vp test, smoke test pages
