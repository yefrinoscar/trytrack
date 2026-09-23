import { describe, expect, test } from 'vite-plus/test'
import { categoryTagClass } from '#/lib/category-colors'

describe('category tag colours', () => {
  test('known categories map to their own colour', () => {
    const food = categoryTagClass('Food')
    const transport = categoryTagClass('Transport')

    expect(food).toContain('emerald')
    expect(transport).toContain('sky')
    expect(food).not.toBe(transport)
  })

  test('is case and whitespace insensitive', () => {
    expect(categoryTagClass('food')).toBe(categoryTagClass('Food'))
    expect(categoryTagClass('  FOOD  ')).toBe(categoryTagClass('Food'))
  })

  test('custom categories still get a stable colour', () => {
    const first = categoryTagClass('Mascotas')
    const second = categoryTagClass('Mascotas')
    const other = categoryTagClass('Viajes')

    expect(first).toBe(second)
    expect(first.startsWith('border-')).toBe(true)
    // Different labels are not guaranteed to differ, but these two do.
    expect(first).not.toBe(other)
  })

  test('handles empty and missing values', () => {
    expect(categoryTagClass(null)).toContain('sky')
    expect(categoryTagClass(undefined)).toContain('sky')
    expect(categoryTagClass('')).toContain('sky')
  })
})
