/**
 * Local replacements for the Convex generated types. Migrated ids are opaque
 * strings, so `Id<T>` is just a string alias (kept for call-site compatibility).
 */
export type Id<_T extends string = string> = string

export type Doc<_T extends string = string> = {
  _id: string
  _creationTime: number
  [key: string]: any
}
