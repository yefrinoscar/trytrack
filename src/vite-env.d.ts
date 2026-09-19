/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Local dev only; the browser uses window.location.origin. */
  readonly VITE_SITE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
