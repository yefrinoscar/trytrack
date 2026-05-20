export interface ParsedEmailExpense {
  amount?: number
  currency?: string
  merchant?: string
  spentAt?: string
  occurredAt?: string
  source?: string
  ownerEmail?: string
  error?: string
  ignore?: boolean
}

function cleanField(value: string) {
  return value
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)[0]
    ?.trim()
}

function decodeHtmlEntities(value: string) {
  const namedEntities: Record<string, string> = {
    amp: '&',
    bull: '•',
    copy: '©',
    eacute: 'é',
    iquest: '¿',
    nbsp: ' ',
    ntilde: 'ñ',
    oacute: 'ó',
    uacute: 'ú',
  }

  return value
    .replace(/&([a-z]+);/gi, (_, name: string) => namedEntities[name] ?? ' ')
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCharCode(Number(code)),
    )
}

function normalizeEmailText(value: string) {
  return decodeHtmlEntities(value)
    .replace(/\r/g, '')
    .replace(/\u200b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractLabeledField(text: string, label: string) {
  const pattern = new RegExp(`${label}:\\s*\\n+\\s*([^\\n]+)`, 'i')
  const match = text.match(pattern)

  return match ? cleanField(match[1] ?? '') : undefined
}

function extractAfter(
  text: string,
  label: string,
  stopLabels: string[],
): string | undefined {
  const pattern = new RegExp(
    `${label.replace(/\s+/g, '\\s+')}\\s+(.+?)(?:\\s+(?:${stopLabels
      .map((stopLabel) => stopLabel.replace(/\s+/g, '\\s+'))
      .join('|')})\\b|$)`,
    'i',
  )
  const match = text.match(pattern)

  return match?.[1]?.trim()
}

function normalizeDate(value: string | undefined) {
  if (!value) {
    return undefined
  }

  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) {
    return undefined
  }

  const day = match[1]!.padStart(2, '0')
  const month = match[2]!.padStart(2, '0')
  const year = match[3]!

  return `${year}-${month}-${day}`
}

const spanishMonthByName: Record<string, string> = {
  enero: '01',
  febrero: '02',
  marzo: '03',
  abril: '04',
  mayo: '05',
  junio: '06',
  julio: '07',
  agosto: '08',
  septiembre: '09',
  setiembre: '09',
  octubre: '10',
  noviembre: '11',
  diciembre: '12',
}

const spanishShortMonthByName: Record<string, string> = {
  ene: '01',
  feb: '02',
  mar: '03',
  abr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  ago: '08',
  sep: '09',
  set: '09',
  oct: '10',
  nov: '11',
  dic: '12',
}

function parseHour(value: string | undefined, period?: string) {
  if (!value) {
    return undefined
  }

  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (!match) {
    return undefined
  }

  let hour = Number(match[1])
  const minute = match[2]!
  const second = match[3] ?? '00'
  const normalizedPeriod = period?.toLowerCase()

  if (normalizedPeriod?.startsWith('p') && hour < 12) {
    hour += 12
  }
  if (normalizedPeriod?.startsWith('a') && hour === 12) {
    hour = 0
  }

  return `${String(hour).padStart(2, '0')}:${minute}:${second}`
}

function normalizeSpanishDateTime(value: string | undefined) {
  if (!value) {
    return {}
  }

  const match = value
    .trim()
    .match(
      /^(\d{1,2})\s+(?:de\s+)?([a-záéíóúñ]+)\.?,?\s*(?:de\s+)?(\d{4})(?:\s+-)?\s+(\d{1,2}:\d{2}(?::\d{2})?)(?:\s+([ap])\.?\s*m\.?|\s+([AP]M))?$/i,
    )

  if (!match) {
    return {}
  }

  const day = match[1]!.padStart(2, '0')
  const monthName = match[2]!.toLowerCase().replace(/\.$/, '')
  const month =
    spanishMonthByName[monthName] ?? spanishShortMonthByName[monthName]
  const year = match[3]!
  const hour = parseHour(match[4], match[5] ?? match[6])

  if (!month || !hour) {
    return {}
  }

  const spentAt = `${year}-${month}-${day}`

  return {
    spentAt,
    occurredAt: `${spentAt}T${hour}`,
  }
}

function normalizeSpanishDate(value: string | undefined) {
  if (!value) {
    return undefined
  }

  const match = value
    .trim()
    .match(/^(\d{1,2})\s+(?:de\s+)?([a-záéíóúñ]+)\.?,?\s*(?:de\s+)?(\d{4})$/i)

  if (!match) {
    return undefined
  }

  const day = match[1]!.padStart(2, '0')
  const monthName = match[2]!.toLowerCase().replace(/\.$/, '')
  const month =
    spanishMonthByName[monthName] ?? spanishShortMonthByName[monthName]

  return month ? `${match[3]!}-${month}-${day}` : undefined
}

function normalizeYapeDateTime(value: string | undefined) {
  return normalizeSpanishDateTime(value)
}

function normalizeAmount(value: string | undefined) {
  if (!value) {
    return undefined
  }

  const normalized = value.replace(/,/g, '').trim()
  const amount = Number(normalized)

  return Number.isFinite(amount) && amount > 0
    ? Math.round(amount * 100) / 100
    : undefined
}

function extractOwnerEmail(text: string, fallback?: string | null) {
  const forwardedTo = text.match(
    /^(?:To|Para):\s*<?([^<>\s]+@[^<>\s]+)>?/im,
  )?.[1]
  const fallbackEmail = fallback?.match(/<?([^<>\s]+@[^<>\s]+)>?/)?.[1]

  return (forwardedTo ?? fallbackEmail)?.toLowerCase()
}

function parseCurrencySymbol(value: string | undefined) {
  if (!value) {
    return undefined
  }

  return value === 'S/' ? 'PEN' : 'USD'
}

function normalizePersonName(value: string | undefined) {
  return value
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^PLIN-/i, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toLowerCase()
}

function isOwnTransferMerchant(value: string | undefined) {
  const normalized = normalizePersonName(value)

  return Boolean(
    normalized &&
    (normalized.includes('yefrin o laura c') ||
      normalized.includes('yefrin oscar laura') ||
      normalized.includes('yefrin oscar laur') ||
      normalized.includes('yefrioscar')),
  )
}

function complete(parsed: ParsedEmailExpense, message: string) {
  if (isOwnTransferMerchant(parsed.merchant)) {
    return {
      ownerEmail: parsed.ownerEmail,
      merchant: parsed.merchant,
      source: parsed.source,
      ignore: true,
      error: 'Internal transfer ignored',
    }
  }

  return {
    ...parsed,
    error:
      parsed.merchant && parsed.amount && parsed.currency && parsed.spentAt
        ? undefined
        : message,
  }
}

export function parseEmailExpense({
  text,
  from,
}: {
  text: string
  from?: string | null
}): ParsedEmailExpense {
  const ownerEmail = extractOwnerEmail(text, from)
  const normalizedText = normalizeEmailText(text)

  const plinMatch = normalizedText.match(
    /Plineaste\s+(S\/|\$)\s*([\d,.]+)\s+a\s+(.+?)\s+Detalles de tu plineo/i,
  )

  if (plinMatch) {
    const { spentAt, occurredAt } = normalizeSpanishDateTime(
      normalizedText.match(
        /Fecha y hora:\s*(.+?)(?:\s+Número de operación|\s+¿Necesitas|\s+Hazlo con|$)/i,
      )?.[1],
    )

    return complete(
      {
        ownerEmail,
        merchant: cleanField(plinMatch[3] ?? ''),
        amount: normalizeAmount(plinMatch[2]),
        currency: parseCurrencySymbol(plinMatch[1]),
        spentAt,
        occurredAt,
        source: 'bbva-plin-transfer',
      },
      'Could not parse all BBVA PLIN expense fields',
    )
  }

  if (/YAPE Notificaciones|Número de\s+operación Yape/i.test(text)) {
    const { spentAt, occurredAt } = normalizeYapeDateTime(
      normalizedText.match(/Fecha y hora:\s*(.+?)(?:\s+Titular|$)/i)?.[1],
    )

    return complete(
      {
        ownerEmail,
        merchant:
          normalizedText.match(/Tu pago en\s+(.+?)\s+fue exitoso/i)?.[1] ??
          'Yape',
        amount: normalizeAmount(
          normalizedText.match(/Monto total\s+(S\/|\$)\s*([\d,.]+)/i)?.[2],
        ),
        currency: parseCurrencySymbol(
          normalizedText.match(/Monto total\s+(S\/|\$)\s*[\d,.]+/i)?.[1],
        ),
        spentAt,
        occurredAt,
        source: 'yape-payment',
      },
      'Could not parse all Yape expense fields',
    )
  }

  if (/Acabas de yapear exitosamente/i.test(normalizedText)) {
    const { spentAt, occurredAt } = normalizeSpanishDateTime(
      normalizedText.match(
        /Fecha y Hora de la operación\s+(.+?)\s+Celular del Beneficiario/i,
      )?.[1],
    )

    return complete(
      {
        ownerEmail,
        merchant:
          normalizedText.match(
            /Nombre del Beneficiario\s+(.+?)\s+N[ºo°]/i,
          )?.[1] ?? 'Yape',
        amount: normalizeAmount(
          normalizedText.match(
            /Monto de yapeo\*?\*?\s+(S\/|\$)\s*([\d,.]+)/i,
          )?.[2],
        ),
        currency: parseCurrencySymbol(
          normalizedText.match(
            /Monto de yapeo\*?\*?\s+(S\/|\$)\s*[\d,.]+/i,
          )?.[1],
        ),
        spentAt,
        occurredAt,
        source: 'yape-transfer',
      },
      'Could not parse all Yape transfer fields',
    )
  }

  if (/Has realizado el siguiente consumo:/i.test(text)) {
    const merchant = extractLabeledField(text, 'Comercio')
    const amount = normalizeAmount(extractLabeledField(text, 'Monto'))
    const currency = extractLabeledField(text, 'Moneda')?.toUpperCase()
    const spentAt = normalizeDate(extractLabeledField(text, 'Fecha'))
    const hour = extractLabeledField(text, 'Hora')

    return complete(
      {
        ownerEmail,
        merchant,
        amount,
        currency,
        spentAt,
        occurredAt: spentAt && hour ? `${spentAt}T${hour}` : spentAt,
        source: 'bbva-card-consumption',
      },
      'Could not parse all BBVA expense fields',
    )
  }

  if (/Realizaste un consumo de/i.test(normalizedText)) {
    const consumptionMatch = normalizedText.match(
      /Realizaste un consumo de\s+(S\/|\$)\s*([\d,.]+)\s+con tu\s+.+?\s+en\s+(.+?)\s*\./i,
    )
    const { spentAt, occurredAt } = normalizeSpanishDateTime(
      extractAfter(normalizedText, 'Fecha y hora', [
        'Número de Tarjeta',
        'Empresa',
      ]),
    )

    return complete(
      {
        ownerEmail,
        merchant:
          extractAfter(normalizedText, 'Empresa', [
            'Número de operación',
            '¿No reconoces',
          ]) ?? consumptionMatch?.[3]?.trim(),
        amount: normalizeAmount(consumptionMatch?.[2]),
        currency: parseCurrencySymbol(consumptionMatch?.[1]),
        spentAt,
        occurredAt,
        source: 'bcp-card-consumption',
      },
      'Could not parse all BCP card consumption fields',
    )
  }

  if (/Pagar con QR/i.test(normalizedText)) {
    const dateValue = extractAfter(normalizedText, 'Fecha de la operación', [
      'Comercio',
    ])
    const { spentAt, occurredAt } = normalizeSpanishDateTime(dateValue)

    return complete(
      {
        ownerEmail,
        merchant: extractAfter(normalizedText, 'Comercio', [
          'Forma de pago',
          'Número de tarjeta',
        ]),
        amount: normalizeAmount(
          normalizedText.match(/Importe pagado\s+(S\/|\$)\s*([\d,.]+)/i)?.[2],
        ),
        currency: parseCurrencySymbol(
          normalizedText.match(/Importe pagado\s+(S\/|\$)\s*[\d,.]+/i)?.[1],
        ),
        spentAt: spentAt ?? normalizeSpanishDate(dateValue),
        occurredAt,
        source: 'bbva-qr-payment',
      },
      'Could not parse all BBVA QR payment fields',
    )
  }

  if (/Pagar servicio/i.test(normalizedText)) {
    const { spentAt, occurredAt } = normalizeSpanishDateTime(
      extractAfter(normalizedText, 'Fecha y hora de la operación', [
        'Cargo en cuenta',
      ]),
    )

    return complete(
      {
        ownerEmail,
        merchant: extractAfter(normalizedText, 'Nombre de servicio', [
          'Descripción',
          'Recuerda',
        ]),
        amount: normalizeAmount(
          normalizedText.match(/Importe pagado\s+(S\/|\$)\s*([\d,.]+)/i)?.[2],
        ),
        currency: parseCurrencySymbol(
          normalizedText.match(/Importe pagado\s+(S\/|\$)\s*[\d,.]+/i)?.[1],
        ),
        spentAt,
        occurredAt,
        source: 'bbva-service-payment',
      },
      'Could not parse all BBVA service payment fields',
    )
  }

  if (/Realizaste una transferencia de/i.test(normalizedText)) {
    const { spentAt, occurredAt } = normalizeSpanishDateTime(
      extractAfter(normalizedText, 'Fecha y hora', ['Enviado a']),
    )

    return complete(
      {
        ownerEmail,
        merchant: extractAfter(normalizedText, 'Enviado a', [
          'Banco destino',
          'Moneda',
        ]),
        amount: normalizeAmount(
          normalizedText.match(
            /Realizaste una transferencia de\s+(S\/|\$)\s*([\d,.]+)/i,
          )?.[2],
        ),
        currency: parseCurrencySymbol(
          normalizedText.match(
            /Realizaste una transferencia de\s+(S\/|\$)\s*[\d,.]+/i,
          )?.[1],
        ),
        spentAt,
        occurredAt,
        source: 'bcp-bank-transfer',
      },
      'Could not parse all BCP transfer fields',
    )
  }

  return {
    ownerEmail,
    error: 'No supported expense email parser matched',
  }
}
