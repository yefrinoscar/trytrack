/**
 * ID generation. Convex IDs migrated from the old deployment are kept as-is
 * (opaque text primary keys); new rows get a URL-safe random id so they never
 * collide with migrated ones.
 */
export function newId(prefix?: string): string {
  const id = crypto.randomUUID().replace(/-/g, '')
  return prefix ? `${prefix}_${id}` : id
}

export function now(): number {
  return Date.now()
}
