/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base path for API calls. Defaults to `/api`, which is proxied. */
  readonly VITE_API_BASE?: string;
  /** Dev server only: where the `/api` proxy points. */
  readonly VITE_API_PROXY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
