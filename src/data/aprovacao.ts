import type { Solicitacao } from '../types'
import { paraApp } from './api'
import { cliente } from './client'

/**
 * Fase D — aprovação por link (RN004).
 *
 * No modo Supabase a página `/aprovacao/:token` roda **sem login**, então não
 * pode ler `solicitacoes` (o RLS da Fase D nega tudo para `anon`). As duas RPCs
 * abaixo são o único caminho: validam o UUID, aplicam a decisão e gravam a
 * auditoria numa transação só.
 *
 * No modo local (sem env vars) a store continua resolvendo tudo no espelho.
 */
export interface ResultadoToken {
  ok: boolean
  erro?: string
  /** Linha atualizada devolvida pelo servidor (modo Supabase). */
  solicitacao?: Solicitacao
  status?: string
}

/** Busca a solicitação dona do token — null/expirado viram erro amigável. */
export async function buscarSolicitacaoPorToken(token: string): Promise<ResultadoToken> {
  const { data, error } = await cliente().rpc('solicitacao_por_token', {
    p_token: token,
  })
  if (error) return { ok: false, erro: `Falha ao consultar o link: ${error.message}` }
  if (!data) {
    return { ok: false, erro: 'Link inválido ou expirado. Peça uma nova aprovação.' }
  }
  const solicitacao = paraApp(
    'SOLICITACOES',
    data as unknown as Record<string, unknown>,
  ) as unknown as Solicitacao
  return { ok: true, solicitacao }
}

/** Aprova/rejeita pelo token. A RPC também escreve o registro de auditoria. */
export async function decidirPorTokenNoServidor(
  token: string,
  acao: 'aprovar' | 'rejeitar',
  motivo?: string,
): Promise<ResultadoToken> {
  const { data, error } = await cliente().rpc('decidir_por_token', {
    p_token: token,
    p_acao: acao,
    p_motivo: motivo?.trim() ? motivo.trim() : null,
  })
  if (error) return { ok: false, erro: `Falha ao registrar a decisão: ${error.message}` }

  const resposta = (data ?? null) as unknown as {
    ok?: boolean
    erro?: string
    status?: string
    id?: string
  } | null
  if (!resposta?.ok) {
    return { ok: false, erro: resposta?.erro ?? 'Não foi possível processar o link.' }
  }

  // regrava o espelho com a linha do servidor (status, datas e motivo exatos)
  const atual = await buscarSolicitacaoPorToken(token)
  return {
    ok: true,
    status: resposta.status,
    solicitacao: atual.ok ? atual.solicitacao : undefined,
  }
}
