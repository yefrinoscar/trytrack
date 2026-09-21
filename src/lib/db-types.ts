/**
 * Shared row types. Primary keys are opaque strings, so `Id<T>` is a string
 * alias used at call sites.
 */
export type Id<_T extends string = string> = string

export type Doc<_T extends string = string> = {
  _id: string
  _creationTime: number
  [key: string]: any
}
