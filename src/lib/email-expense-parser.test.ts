import { describe, expect, test } from 'vite-plus/test'
import { parseEmailExpense } from './email-expense-parser'

describe('parseEmailExpense', () => {
  test('parses BBVA card consumption forwards', () => {
    const parsed = parseEmailExpense({
      from: 'yefrioscar9814@gmail.com',
      text: `---------- Forwarded message ---------
De: BBVA <procesos@bbva.com.pe>
Date: mar, 19 may 2026 a las 10:17
Subject: Has realizado un consumo con tu tarjeta BBVA
To: <yefrioscar9814@gmail.com>

Has realizado el siguiente consumo:

Comercio:

TRIPO AI

Monto:

2.00

Moneda:

PEN

Fecha:

19/05/2026

Hora:

10:17:51`,
    })

    expect(parsed).toEqual({
      amount: 2,
      currency: 'PEN',
      error: undefined,
      merchant: 'TRIPO AI',
      occurredAt: '2026-05-19T10:17:51',
      ownerEmail: 'yefrioscar9814@gmail.com',
      source: 'bbva-card-consumption',
      spentAt: '2026-05-19',
    })
  })
})
