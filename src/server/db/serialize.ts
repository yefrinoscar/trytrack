/** Convex-compatible document shape returned by the local API. */
type AppRow = { id: string; createdAt: number }

/**
 * Adds the Convex-style `_id` / `_creationTime` aliases on top of a Drizzle row
 * so existing client code understands the result.
 */
export function toDoc<T extends AppRow>(row: T) {
  const { id, createdAt, ...rest } = row
  return {
    _id: id,
    _creationTime: createdAt,
    createdAt,
    ...rest,
  }
}

export function toDocs<T extends AppRow>(rows: T[]) {
  return rows.map(toDoc)
}
