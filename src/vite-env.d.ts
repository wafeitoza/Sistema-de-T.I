interface ImportMetaEnv {
  /** URL do projeto Supabase (ex.: https://xxxx.supabase.co). Ausente = modo local. */
  readonly VITE_SUPABASE_URL?: string
  /** Chave publishable (pública, vai para o bundle). Ausente = modo local. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
}
