/**
 * SSR stub for `@tanstack/router-devtools-core`.
 *
 * That package calls `window`/`document` at module scope, and the SSR bundler
 * otherwise co-locates shared helpers (`clsx`) inside its chunk, which crashes
 * the Cloudflare Worker during server rendering. Devtools are a browser-only,
 * development-only concern, so the server never needs the real module.
 */
export const BaseTanStackRouterDevtoolsPanel = () => null
export const BaseTanStackRouterDevtoolsPanel$1 = () => null
export const FloatingTanStackRouterDevtools = () => null
export const useLocalStorage = () => [undefined, () => {}] as const
export const useIsMounted = () => false
export const useStyles = () => ({})
export const useStyles$1 = () => ({})
export default FloatingTanStackRouterDevtools
