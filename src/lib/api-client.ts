import { createServerFn } from '@tanstack/react-start'

type RpcInput = {
  path: string
  args: Record<string, unknown> | undefined
}

/** Server-side dispatcher callable from the client over TanStack server functions. */
export const rpc = createServerFn({ method: 'POST' })
  .inputValidator((data: RpcInput) => data)
  .handler(async ({ data }): Promise<any> => {
    const { runRpc } = await import('../server/rpc.server')
    return await runRpc(data)
  })

export type ApiClient = {
  query: <T = any>(path: string, args?: Record<string, unknown>) => Promise<T>
  mutation: <T = any>(
    path: string,
    args?: Record<string, unknown>,
  ) => Promise<T>
}

/**
 * Data client backed by the RPC endpoint. Call sites use
 * `apiClient.query(api.x.y, args)` / `apiClient.mutation(...)`.
 */
export function useApi(): ApiClient {
  return {
    query: <T = any>(path: string, args?: Record<string, unknown>) =>
      rpc({ data: { path, args } }) as Promise<T>,
    mutation: <T = any>(path: string, args?: Record<string, unknown>) =>
      rpc({ data: { path, args } }) as Promise<T>,
  }
}
