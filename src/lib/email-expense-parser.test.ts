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

  test('parses BBVA PLIN transfer forwards', () => {
    const parsed = parseEmailExpense({
      from: 'yefrioscar9814@gmail.com',
      text: `---------- Forwarded message ---------
De: BBVA <procesos@bbva.com.pe>
Date: vie, 15 may 2026 a las 13:00
Subject: Constancia de operación transferencia PLIN
To: <YEFRIOSCAR9814@gmail.com>

Hola, YEFRIN

Plineaste S/ 32.00 a Yefrin O Laura C

Detalles de tu plineo
Celular: •7211
Destino: Yape
ITF: S/ 0.00
Fecha y hora: 15 de mayo, 2026 13:00
Número de operación: FEAC3B8601D4`,
    })

    expect(parsed).toEqual({
      error: 'Internal transfer ignored',
      ignore: true,
      merchant: 'Yefrin O Laura C',
      ownerEmail: 'yefrioscar9814@gmail.com',
      source: 'bbva-plin-transfer',
    })
  })

  test('parses Yape payment forwards', () => {
    const parsed = parseEmailExpense({
      from: 'yefrioscar9814@gmail.com',
      text: `---------- Forwarded message ---------
De: YAPE Notificaciones <notificaciones@yape.pe>
Date: sáb, 16 may 2026 a las 15:33
Subject: Envío Automático - Constancia de Transferencia - Yape
To: <YEFRIOSCAR9814@gmail.com>

[image: yape]
Hola YEFRIN,
¡Tu pago en Yape Promos fue exitoso!
Monto total
S/ 27.80
Fecha y hora: 16 may. 2026 - 03:33 p. m.
Titular: YEFRIN OSCAR LAURA CHAVEZ
Celular: *** *** 211
Número de
operación Yape: 1714595`,
    })

    expect(parsed).toEqual({
      amount: 27.8,
      currency: 'PEN',
      error: undefined,
      merchant: 'Yape Promos',
      occurredAt: '2026-05-16T15:33:00',
      ownerEmail: 'yefrioscar9814@gmail.com',
      source: 'yape-payment',
      spentAt: '2026-05-16',
    })
  })

  test('parses BBVA PLIN HTML-style inline details', () => {
    const parsed = parseEmailExpense({
      from: 'BBVA <procesos@bbva.com.pe>',
      text: `Hola, YEFRIN
Plineaste S/ 24.00 a Iris Fabian P
Detalles de tu plineo
Concepto: Taxi Celular: &bull;4525 Destino: Yape ITF: S/ 0.00 Fecha y hora: 19 de mayo, 2026 06:16 N&uacute;mero de operaci&oacute;n: C6E058E997E8`,
    })

    expect(parsed).toMatchObject({
      amount: 24,
      currency: 'PEN',
      error: undefined,
      merchant: 'Iris Fabian P',
      occurredAt: '2026-05-19T06:16:00',
      source: 'bbva-plin-transfer',
      spentAt: '2026-05-19',
    })
  })

  test('parses Yape transfer security notifications', () => {
    const parsed = parseEmailExpense({
      from: 'YAPE Notificaciones <notificaciones@yape.pe>',
      text: `*¡Hola, Yefrin Lau*!*
*¡Acabas de yapear exitosamente!*
*Monto de yapeo**
S/ 12.00
Yapero Yefrin Lau* Tu número de celular XXXXXXXXX211 Fecha y Hora de la operación 16 mayo 2026 - 04:32 p. m. Celular del Beneficiario XXXXXXXXX094 Nombre del Beneficiario Felipe Mar* Nº de operación 22734009`,
    })

    expect(parsed).toMatchObject({
      amount: 12,
      currency: 'PEN',
      error: undefined,
      merchant: 'Felipe Mar*',
      occurredAt: '2026-05-16T16:32:00',
      source: 'yape-transfer',
      spentAt: '2026-05-16',
    })
  })

  test('parses BCP debit card consumption notifications', () => {
    const parsed = parseEmailExpense({
      from: 'BCP Notificaciones <notificaciones@notificacionesbcp.com.pe>',
      text: `Hola Yefrin Oscar,
Realizaste un consumo de S/ 61.00 con tu Tarjeta de Débito BCP en PLIN-IRIS FABIAN.
Datos de la operación
Operación realizada
Consumo Tarjeta de Débito
Fecha y hora
16 de mayo de 2026 - 09:02 PM
Número de Tarjeta de Débito
************9724
Empresa
PLIN-IRIS FABIAN
Número de operación
783185`,
    })

    expect(parsed).toMatchObject({
      amount: 61,
      currency: 'PEN',
      error: undefined,
      merchant: 'PLIN-IRIS FABIAN',
      occurredAt: '2026-05-16T21:02:00',
      source: 'bcp-card-consumption',
      spentAt: '2026-05-16',
    })
  })

  test('parses BBVA QR payments', () => {
    const parsed = parseEmailExpense({
      from: 'BBVA <procesos@bbva.com.pe>',
      text: `Hola, YEFRIN OSCAR Has realizado con éxito la operación:
Pagar con QR
Importe pagado
S/ 10.00
DETALLES DE LA OPERACIÓN
Fecha de la operación
16 de mayo, 2026
Comercio
IZI*FLORAZA
Forma de pago
VISA COMPRAS`,
    })

    expect(parsed).toMatchObject({
      amount: 10,
      currency: 'PEN',
      error: undefined,
      merchant: 'IZI*FLORAZA',
      occurredAt: undefined,
      source: 'bbva-qr-payment',
      spentAt: '2026-05-16',
    })
  })

  test('parses BBVA service payments', () => {
    const parsed = parseEmailExpense({
      from: 'BBVA <procesos@bbva.com.pe>',
      text: `Has realizado con éxito la operación:
Pagar servicio
Importe pagado
S/ 40.00
Fecha y hora de la operación
07 mayo, 2026 16:08
Cargo en cuenta
• 6289
Nombre de servicio
WIN INTERNET
Descripción o Número Documento Servicio
Sr11-02439667`,
    })

    expect(parsed).toMatchObject({
      amount: 40,
      currency: 'PEN',
      error: undefined,
      merchant: 'WIN INTERNET',
      occurredAt: '2026-05-07T16:08:00',
      source: 'bbva-service-payment',
      spentAt: '2026-05-07',
    })
  })

  test('parses BCP bank transfers', () => {
    const parsed = parseEmailExpense({
      from: 'BCP Notificaciones <notificaciones@notificacionesbcp.com.pe>',
      text: `Hola Yefrin Oscar,
Realizaste una transferencia de S/ 199.50 desde tu Clasica.
Datos de la operación
Fecha y hora
09 de Mayo de 2026 - 08:58 PM
Enviado a
Iris Fabian P.
**** 8911
Banco destino
Bbva
Moneda
Soles`,
    })

    expect(parsed).toMatchObject({
      amount: 199.5,
      currency: 'PEN',
      error: undefined,
      merchant: 'Iris Fabian P. **** 8911',
      occurredAt: '2026-05-09T20:58:00',
      source: 'bcp-bank-transfer',
      spentAt: '2026-05-09',
    })
  })

  test('ignores transfers to the TryTrack owner', () => {
    const bbvaPlin = parseEmailExpense({
      from: 'BBVA <procesos@bbva.com.pe>',
      text: `Hola, YEFRIN
Plineaste S/ 5.00 a Yefrin O Laura C
Detalles de tu plineo
Fecha y hora: 04 de mayo, 2026 12:20
Número de operación: ABC123`,
    })
    const bcpPlin = parseEmailExpense({
      from: 'BCP Notificaciones <notificaciones@notificacionesbcp.com.pe>',
      text: `Realizaste un consumo de S/ 35.00 con tu Tarjeta de Débito BCP en PLIN-Yefrin oscar Laur.
Fecha y hora
04 de mayo de 2026 - 02:18 PM
Empresa
PLIN-Yefrin oscar Laur
Número de operación
12345`,
    })

    expect(bbvaPlin).toMatchObject({
      error: 'Internal transfer ignored',
      ignore: true,
      merchant: 'Yefrin O Laura C',
      source: 'bbva-plin-transfer',
    })
    expect(bcpPlin).toMatchObject({
      error: 'Internal transfer ignored',
      ignore: true,
      merchant: 'PLIN-Yefrin oscar Laur',
      source: 'bcp-card-consumption',
    })
  })
})
