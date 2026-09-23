import { getEnv } from './env'

/**
 * Shared-key authentication for the public API.
 *
 * Both the expenses and recurring-payments endpoints use the same
 * `EXPENSES_API_KEY` Worker secret and the same `Authorization: Bearer <key>`
 * header, so the check lives here instead of being copied per route.
 */

const API_KEY_ENV = 'EXPENSES_API_KEY'

export function isApiKeyConfigured() {
  return Boolean(getEnv(API_KEY_ENV))
}

export const API_DISABLED_MESSAGE =
  'The API is disabled: EXPENSES_API_KEY is not configured.'

export function isApiAuthorized(request: Request) {
  const expected = getEnv(API_KEY_ENV)
  if (!expected) {
    return false
  }

  const header = request.headers.get('authorization') ?? ''
  const provided = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!provided) {
    return false
  }

  // Constant-time-ish comparison: avoids trivially leaking length differences.
  if (provided.length !== expected.length) {
    return false
  }

  let diff = 0
  for (let index = 0; index < provided.length; index += 1) {
    diff |= provided.charCodeAt(index) ^ expected.charCodeAt(index)
  }

  return diff === 0
}

export function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, { status })
}

export function asTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}
