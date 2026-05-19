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

  return forwardedTo ?? fallbackEmail
}

export function parseEmailExpense({
  text,
  from,
}: {
  text: string
  from?: string | null
}): ParsedEmailExpense {
  const ownerEmail = extractOwnerEmail(text, from)

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
