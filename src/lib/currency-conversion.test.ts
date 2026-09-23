import { describe, expect, test } from 'vite-plus/test'
import { convertCurrency } from '#/lib/finance'

const RATE = 3.38 // PEN per USD

describe('convertCurrency', () => {
  test('converts USD to PEN and back', () => {
    expect(convertCurrency(100, 'USD', 'PEN', RATE)).toBeCloseTo(338, 6)
    expect(convertCurrency(338, 'PEN', 'USD', RATE)).toBeCloseTo(100, 6)
  })

  test('returns the amount unchanged for the same currency', () => {
    expect(convertCurrency(100, 'USD', 'USD', RATE)).toBe(100)
    expect(convertCurrency(100, 'pen', 'PEN', RATE)).toBe(100)
  })

  test('is case insensitive', () => {
    expect(convertCurrency(100, 'usd', 'pen', RATE)).toBeCloseTo(338, 6)
  })

  test('returns null for an unsupported pair instead of guessing', () => {
    expect(convertCurrency(100, 'USD', 'EUR', RATE)).toBeNull()
    expect(convertCurrency(100, 'EUR', 'PEN', RATE)).toBeNull()
  })

  test('returns null for a missing or nonsense rate', () => {
    expect(convertCurrency(100, 'USD', 'PEN', 0)).toBeNull()
    expect(convertCurrency(100, 'USD', 'PEN', -3)).toBeNull()
    expect(convertCurrency(100, 'USD', 'PEN', Number.NaN)).toBeNull()
  })
})
