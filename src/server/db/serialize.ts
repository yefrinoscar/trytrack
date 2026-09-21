/** Document shape returned by the data API. */
type AppRow = { id: string; createdAt: number }

/**
 * Adds `_id` / `_creationTime` aliases on top of a Drizzle row. Client code
 * reads those aliases when rendering lists.
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
