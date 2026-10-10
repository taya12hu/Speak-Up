/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL, e.g. https://abcd.supabase.co (public). */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase publishable (or legacy anon) key. Public by design; never put the service-role key here. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
