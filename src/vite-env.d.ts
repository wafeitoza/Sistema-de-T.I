/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL do projeto Supabase (ex.: https://xxxx.supabase.co). Ausente = modo local. */
  readonly VITE_SUPABASE_URL?: string
  /** Chave publishable (pública, vai para o bundle). Ausente = modo local. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  /**
   * DSN do Sentry (Fase E, item 15). Ausente = erros só no console e na aba
   * Auditoria, como sempre. Presente = `src/data/erros.ts` liga o SDK.
   */
  readonly VITE_SENTRY_DSN?: string
}
