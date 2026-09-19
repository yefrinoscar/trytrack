/**
 * ID generation. Primary keys are opaque text; new rows get a URL-safe random
 * id.
 */
export function newId(prefix?: string): string {
  const id = crypto.randomUUID().replace(/-/g, '')
  return prefix ? `${prefix}_${id}` : id
}

export function now(): number {
  return Date.now()
}
