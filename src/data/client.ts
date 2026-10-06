import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const URL = import.meta.env.VITE_SUPABASE_URL
const CHAVE = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

/**
 * `true` quando há credenciais no ambiente (Vercel/preview/.env.local).
 * Sem credenciais o app roda 100% no localStorage — é o modo usado pelo dev
 * sem env e é o modo que os testes devem usar SEMPRE (o vitest carrega o
 * `.env.local`, então o modo `test` é bloqueado de propósito: nenhum teste
 * pode bater no banco de produção).
 */
export const modoSupabase =
  import.meta.env.MODE !== 'test' && Boolean(URL && CHAVE)

let unico: SupabaseClient | null = null

/** Cliente único. Só existe sentido chamar quando `modoSupabase` é true. */
export function cliente(): SupabaseClient {
  if (!URL || !CHAVE) {
    throw new Error('Supabase não configurado (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY)')
  }
  if (!unico) {
    unico = createClient(URL, CHAVE, {
      // Auth chega na Fase C; por enquanto usamos só PostgREST/RPC.
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { 'x-client-info': 'it-stock-web' } },
    })
  }
  return unico
}
