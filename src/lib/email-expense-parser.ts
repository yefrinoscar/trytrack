export interface ParsedEmailExpense {
  amount?: number
  currency?: string
  merchant?: string
  spentAt?: string
  occurredAt?: string
  source?: string
  ownerEmail?: string
  error?: string
}

function cleanField(value: string) {
  return value
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)[0]
    ?.trim()
}

function extractLabeledField(text: string, label: string) {
  const pattern = new RegExp(`${label}:\\s*\\n+\\s*([^\\n]+)`, 'i')
  const match = text.match(pattern)

  return match ? cleanField(match[1] ?? '') : undefined
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

function normalizeSpanishDateTime(value: string | undefined) {
  if (!value) {
    return {}
  }

  const match = value
    .trim()
    .match(/^(\d{1,2})\s+de\s+([a-záéíóúñ]+),\s*(\d{4})\s+(\d{1,2}:\d{2})$/i)

  if (!match) {
    return {}
  }

  const day = match[1]!.padStart(2, '0')
  const month = spanishMonthByName[match[2]!.toLowerCase()]
  const year = match[3]!
  const hour = match[4]!

  if (!month) {
    return {}
  }

  const spentAt = `${year}-${month}-${day}`

  return {
    spentAt,
    occurredAt: `${spentAt}T${hour}:00`,
  }
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
  const forwardedTo = text.match(/^(?:To|Para):\s*<?([^>\s]+@[^>\s]+)>?/im)?.[1]
  const fallbackEmail = fallback?.match(/<?([^<>\s]+@[^<>\s]+)>?/)?.[1]

  return (forwardedTo ?? fallbackEmail)?.toLowerCase()
}

function parseCurrencySymbol(value: string | undefined) {
  if (!value) {
    return undefined
  }

  return value === 'S/' ? 'PEN' : 'USD'
}

export function parseEmailExpense({
  text,
  from,
}: {
  text: string
  from?: string | null
}): ParsedEmailExpense {
  const ownerEmail = extractOwnerEmail(text, from)

  const plinMatch = text.match(
    /Plineaste\s+(S\/|\$)\s*([\d,.]+)\s+a\s+([^\n]+)/i,
  )

  if (plinMatch) {
    const currency = parseCurrencySymbol(plinMatch[1])
    const amount = normalizeAmount(plinMatch[2])
    const merchant = cleanField(plinMatch[3] ?? '')
    const { spentAt, occurredAt } = normalizeSpanishDateTime(
      text.match(/Fecha y hora:\s*([^\n]+)/i)?.[1],
    )

    return {
      ownerEmail,
      merchant,
      amount,
      currency,
      spentAt,
      occurredAt,
      source: 'bbva-plin-transfer',
      error:
        merchant && amount && currency && spentAt
          ? undefined
          : 'Could not parse all BBVA PLIN expense fields',
    }
  }

  if (/Has realizado el siguiente consumo:/i.test(text)) {
    const merchant = extractLabeledField(text, 'Comercio')
    const amount = normalizeAmount(extractLabeledField(text, 'Monto'))
    const currency = extractLabeledField(text, 'Moneda')?.toUpperCase()
    const spentAt = normalizeDate(extractLabeledField(text, 'Fecha'))
    const hour = extractLabeledField(text, 'Hora')

    return {
      ownerEmail,
      merchant,
      amount,
      currency,
      spentAt,
      occurredAt: spentAt && hour ? `${spentAt}T${hour}` : spentAt,
      source: 'bbva-card-consumption',
      error:
        merchant && amount && currency && spentAt
          ? undefined
          : 'Could not parse all BBVA expense fields',
    }
  }

  return {
    ownerEmail,
    error: 'No supported expense email parser matched',
  }
}
