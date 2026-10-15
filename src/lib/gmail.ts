import { tokenAtual } from '../data/auth'

/**
 * Cliente das Functions de integração (`/api/chamados`, `/api/google-oauth`).
 *
 * Este é o único ponto do navegador que fala com o Gmail — e ele fala com o
 * NOSSO servidor, nunca com o Google. O refresh token fica cifrado no banco e
 * as Functions o usam de dentro; daqui sai só o access token da sessão do
 * Supabase, que já trafega em toda chamada ao backend.
 */

export interface StatusGmail {
  conectado: boolean
  conta: string | null
  filtro: string | null
  ultimaSincronizacao: string | null
}

export interface ResultadoApi {
  ok: boolean
  status: number
  erro?: string
  dados?: Record<string, unknown>
}

async function chamar(caminho: string, corpo: Record<string, unknown>): Promise<ResultadoApi> {
  const token = await tokenAtual()
  if (!token) return { ok: false, status: 401, erro: 'Sessão ausente' }

  try {
    const resposta = await fetch(caminho, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(corpo),
    })
    const dados = (await resposta.json().catch(() => null)) as Record<string, unknown> | null
    return {
      ok: resposta.ok,
      status: resposta.status,
      erro: resposta.ok ? undefined : String(dados?.erro ?? `HTTP ${resposta.status}`),
      dados: dados ?? undefined,
    }
  } catch (erro) {
    return { ok: false, status: 0, erro: (erro as Error).message }
  }
}

export async function statusGmail(): Promise<StatusGmail> {
  const r = await chamar('/api/chamados', { acao: 'status' })
  if (!r.ok) return { conectado: false, conta: null, filtro: null, ultimaSincronizacao: null }
  return {
    conectado: Boolean(r.dados?.conectado),
    conta: (r.dados?.conta as string | null) ?? null,
    filtro: (r.dados?.filtro as string | null) ?? null,
    ultimaSincronizacao: (r.dados?.ultimaSincronizacao as string | null) ?? null,
  }
}

/**
 * Devolve a URL de autorização para a qual a página deve navegar.
 *
 * A iniciação é um POST porque um redirect de navegador não leva header de
 * autenticação, e pôr o token do Supabase na query o deixaria no histórico e
 * nos logs. Ver `api/google-oauth.mjs`.
 */
export async function urlDeConexao(): Promise<string | null> {
  const r = await chamar('/api/google-oauth', { acao: 'iniciar' })
  if (!r.ok) return null
  return (r.dados?.url as string | undefined) ?? null
}

export async function conectarGmail(): Promise<ResultadoApi> {
  const url = await urlDeConexao()
  if (!url) return { ok: false, status: 500, erro: 'Não foi possível iniciar a autorização' }
  window.location.assign(url)
  return { ok: true, status: 200 }
}

export async function sincronizarGmail(): Promise<ResultadoApi> {
  return chamar('/api/chamados', { acao: 'sincronizar' })
}

export async function responderPorGmail(chamadoId: string, texto: string): Promise<ResultadoApi> {
  return chamar('/api/chamados', { acao: 'responder', chamadoId, texto })
}

export async function definirFiltroGmail(filtro: string): Promise<ResultadoApi> {
  return chamar('/api/chamados', { acao: 'definirFiltro', filtro })
}
