import { create } from 'zustand'
import {
  decidirPorTokenNoServidor,
} from '../data/aprovacao'
import { modoSupabase } from '../data/client'
import {
  gravarColecao,
  lerColecao,
  proximaSequencia,
  recarregarLog,
} from '../data/repository'
import { calcularDiff, registrarLog } from '../lib/audit'
import { agoraISO, hojeBR } from '../lib/format'
import { gerarTokenAprovacao, validarTokenAprovacao } from '../lib/token'
import { useAuthStore } from './auth'
import type {
  Prioridade,
  Solicitacao,
  StatusSolicitacao,
  TipoSolicitacao,
} from '../types'

const COLECAO = 'SOLICITACOES'

function usuarioAtual(): string {
  return useAuthStore.getState().usuario?.email ?? 'sistema@empresa.com'
}

export interface NovaSolicitacao {
  solicitante: string
  tipo: TipoSolicitacao
  descricao: string
  prioridade: Prioridade
  aprovador: string
  notasInternas?: string
}

export interface ResultadoDecisao {
  ok: boolean
  erro?: string
}

interface SolicitacoesState {
  solicitacoes: Solicitacao[]
  recarregar: () => void
  criar: (dados: NovaSolicitacao) => Solicitacao
  editar: (
    id: string,
    campos: Partial<Solicitacao>,
    /** Campos que mudam mas não podem aparecer no log (ex.: token do link). */
    ocultarNoLog?: string[],
  ) => void
  enviar: (id: string) => { ok: boolean; erro?: string; link?: string }
  decidir: (
    id: string,
    acao: 'aprovar' | 'rejeitar',
    motivo?: string,
  ) => ResultadoDecisao
  decidirPorToken: (
    token: string,
    acao: 'aprovar' | 'rejeitar',
    motivo?: string,
  ) => Promise<ResultadoDecisao>
  finalizar: (id: string) => void
}

function aplicarDecisao(
  acao: 'aprovar' | 'rejeitar',
  motivo?: string,
): Partial<Solicitacao> {
  return acao === 'aprovar'
    ? { status: 'Aprovada', dataAprovacao: hojeBR(), atualizadoEm: agoraISO() }
    : {
        status: 'Rejeitada',
        dataAprovacao: hojeBR(),
        motivoRejeicao: motivo || 'Sem motivo informado',
        atualizadoEm: agoraISO(),
      }
}

export const useSolicitacoesStore = create<SolicitacoesState>((set, get) => ({
  solicitacoes: lerColecao<Solicitacao>(COLECAO),

  recarregar: () => set({ solicitacoes: lerColecao<Solicitacao>(COLECAO) }),

  criar: (dados) => {
    const solicitacao: Solicitacao = {
      id: `SOL-${new Date().getFullYear()}-${String(proximaSequencia('SOL')).padStart(6, '0')}`,
      data: hojeBR(),
      status: 'Rascunho',
      criadoEm: agoraISO(),
      atualizadoEm: agoraISO(),
      ...dados,
    }
    const proximas = [solicitacao, ...get().solicitacoes]
    gravarColecao(COLECAO, proximas)
    registrarLog({
      usuario: usuarioAtual(),
      acao: 'CREATE',
      tabela: 'SOLICITACOES',
      registroId: solicitacao.id,
      campos: Object.entries(solicitacao).map(([campo, valor]) => ({
        campo,
        antes: null,
        depois: valor,
      })),
    })
    set({ solicitacoes: proximas })
    return solicitacao
  },

  editar: (id, campos, ocultarNoLog = []) => {
    const atual = get().solicitacoes
    const alvo = atual.find((s) => s.id === id)
    if (!alvo) return
    const proximas = atual.map((s) =>
      s.id === id ? { ...s, ...campos, atualizadoEm: agoraISO() } : s,
    )
    gravarColecao(COLECAO, proximas)
    registrarLog({
      usuario: usuarioAtual(),
      acao: 'UPDATE',
      tabela: 'SOLICITACOES',
      registroId: id,
      campos: calcularDiff(
        alvo as unknown as Record<string, unknown>,
        { ...alvo, ...campos } as unknown as Record<string, unknown>,
      ).filter((c) => !ocultarNoLog.includes(c.campo)),
    })
    set({ solicitacoes: proximas })
  },

  enviar: (id) => {
    const alvo = get().solicitacoes.find((s) => s.id === id)
    if (!alvo) return { ok: false, erro: 'Solicitação não encontrada' }
    if (alvo.status !== 'Rascunho') {
      return { ok: false, erro: 'Apenas rascunhos podem ser enviados' }
    }
    // RN004 (Fase D): UUID aleatório — id e aprovador não vão na URL.
    const { token, expiraEm } = gerarTokenAprovacao()
    get().editar(
      id,
      {
        status: 'Enviada',
        aprovacaoToken: token,
        tokenExpiraEm: expiraEm,
      } as Partial<Solicitacao>,
      ['aprovacaoToken', 'tokenExpiraEm'],
    )
    return { ok: true }
  },

  decidir: (id, acao, motivo) => {
    const alvo = get().solicitacoes.find((s) => s.id === id)
    if (!alvo) return { ok: false, erro: 'Solicitação não encontrada' }
    if (alvo.status !== 'Enviada') {
      return { ok: false, erro: 'A solicitação não está aguardando decisão' }
    }
    get().editar(id, aplicarDecisao(acao, motivo))
    return { ok: true }
  },

  decidirPorToken: async (token, acao, motivo) => {
    const validacao = validarTokenAprovacao(token)
    if (!validacao.valido) {
      return { ok: false, erro: validacao.motivo ?? 'Token inválido' }
    }

    // Modo Supabase: quem decide é o banco. O visitante do link é `anon` e não
    // tem acesso a nenhuma tabela (RLS da Fase D), então a decisão passa pela
    // RPC — que também grava a auditoria numa transação só.
    if (modoSupabase) {
      const remoto = await decidirPorTokenNoServidor(token, acao, motivo)
      if (!remoto.ok) return { ok: false, erro: remoto.erro }

      const lista = get().solicitacoes
      const alvo = lista.find((s) => s.aprovacaoToken === token)
      if (alvo) {
        const novo = remoto.solicitacao ?? { ...alvo, ...aplicarDecisao(acao, motivo) }
        const proximas = lista.map((s) => (s.id === alvo.id ? novo : s))
        // sem registrarLog: a RPC já deixou o registro no servidor
        gravarColecao(COLECAO, proximas)
        set({ solicitacoes: proximas })
      }
      void recarregarLog()
      return { ok: true }
    }

    const alvo = get().solicitacoes.find((s) => s.aprovacaoToken === token)
    if (!alvo) return { ok: false, erro: 'Token inválido' }
    if (!alvo.tokenExpiraEm || new Date(alvo.tokenExpiraEm).getTime() < Date.now()) {
      return { ok: false, erro: 'Link expirado (validade de 7 dias)' }
    }
    if (alvo.status !== 'Enviada') {
      return { ok: false, erro: 'Esta solicitação já foi decidida' }
    }
    get().editar(alvo.id, aplicarDecisao(acao, motivo))
    registrarLog({
      usuario: alvo.aprovador || 'desconhecido',
      acao: 'UPDATE',
      tabela: 'SOLICITACOES',
      registroId: alvo.id,
      campos: [{ campo: 'status', antes: 'Enviada', depois: acao === 'aprovar' ? 'Aprovada' : 'Rejeitada' }],
      mensagem: `Decisão via link assinado (${acao})`,
    })
    return { ok: true }
  },

  finalizar: (id) => {
    const alvo = get().solicitacoes.find((s) => s.id === id)
    if (!alvo) return
    if (alvo.status !== 'Aprovada') return
    get().editar(id, {
      status: 'Finalizada' as StatusSolicitacao,
      dataFinalizacao: hojeBR(),
    } as Partial<Solicitacao>)
  },
}))
