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

/**
 * O navegador recusa `keepalive` com body acima de ~64 KB; abaixo disso ele
 * mantém a requisição viva mesmo quando a página descarrega (F5 no meio de um
 * sync). Sem isso, um refresh 200 ms depois de salvar perdia a escrita.
 */
const LIMITE_KEEPALIVE = 60_000

const fetchComKeepalive: typeof fetch = (entrada, init) => {
  const metodo = (init?.method ?? 'GET').toUpperCase()
  const corpo = typeof init?.body === 'string' ? init.body.length : 0
  const gravacao = metodo !== 'GET' && metodo !== 'HEAD'
  return fetch(entrada, {
    ...init,
    keepalive: gravacao && corpo < LIMITE_KEEPALIVE,
  })
}

/** Cliente único. Só existe sentido chamar quando `modoSupabase` é true. */
export function cliente(): SupabaseClient {
  if (!URL || !CHAVE) {
    throw new Error('Supabase não configurado (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY)')
  }
  if (!unico) {
    unico = createClient(URL, CHAVE, {
      // Sessão de e-mail+senha persistida (localStorage) + renovação automática.
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      global: {
        headers: { 'x-client-info': 'it-stock-web' },
        fetch: fetchComKeepalive,
      },
    })
  }
  return unico
}
