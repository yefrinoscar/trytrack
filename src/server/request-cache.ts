/**
 * Per-request memoisation.
 *
 * Values are stored on the Request object rather than in module scope: a
 * Worker isolate is reused across requests, so module-level state would leak
 * one caller's session into the next. The request object is unique per call.
 *
 * Outside a request context the loader simply runs every time.
 */
export async function requestCache<T>(
  key: string,
  load: () => Promise<T>,
): Promise<T> {
  const { getRequest } = await import('@tanstack/react-start/server')

  let request: Request | undefined
  try {
    request = getRequest()
  } catch {
    return await load()
  }

  const store = request as Request & Record<string, unknown>
  if (key in store) {
    return store[key] as T
  }

  const value = await load()
  store[key] = value
  return value
}
