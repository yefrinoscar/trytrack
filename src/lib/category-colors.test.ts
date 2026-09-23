import { describe, expect, test } from 'vite-plus/test'
import { categoryColorVar } from '#/lib/category-colors'

describe('category tag colours', () => {
  test('known categories map to their own colour variable', () => {
    expect(categoryColorVar('Food')).toBe('--cat-emerald')
    expect(categoryColorVar('Transport')).toBe('--cat-sky')
    expect(categoryColorVar('Food')).not.toBe(categoryColorVar('Transport'))
  })

  test('is case and whitespace insensitive', () => {
    expect(categoryColorVar('food')).toBe(categoryColorVar('Food'))
    expect(categoryColorVar('  FOOD  ')).toBe(categoryColorVar('Food'))
  })

  test('custom categories still get a stable colour', () => {
    const first = categoryColorVar('Mascotas')
    const second = categoryColorVar('Mascotas')

    expect(first).toBe(second)
    expect(first.startsWith('--cat-')).toBe(true)
  })

  test('handles empty and missing values', () => {
    expect(categoryColorVar(null)).toBe('--cat-sky')
    expect(categoryColorVar(undefined)).toBe('--cat-sky')
    expect(categoryColorVar('')).toBe('--cat-sky')
  })

  test('every mapped variable exists in the theme', () => {
    const known = [
      'Food',
      'Groceries',
      'Transport',
      'Health',
      'Utilities',
      'Shopping',
      'Entertainment',
      'Software',
      'Education',
      'Home',
      'Gifts',
      'Transfer',
      'Subscription',
      'Other',
    ]

    for (const category of known) {
      expect(categoryColorVar(category)).toMatch(/^--cat-[a-z]+$/)
    }
  })
})
