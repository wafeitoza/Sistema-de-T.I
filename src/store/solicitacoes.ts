import { create } from 'zustand'
import { gravarColecao, lerColecao, proximaSequencia } from '../data/repository'
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
  editar: (id: string, campos: Partial<Solicitacao>) => void
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
  ) => ResultadoDecisao
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

  editar: (id, campos) => {
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
      ),
    })
    set({ solicitacoes: proximas })
  },

  enviar: (id) => {
    const alvo = get().solicitacoes.find((s) => s.id === id)
    if (!alvo) return { ok: false, erro: 'Solicitação não encontrada' }
    if (alvo.status !== 'Rascunho') {
      return { ok: false, erro: 'Apenas rascunhos podem ser enviados' }
    }
    const { token, expiraEm } = gerarTokenAprovacao(id, alvo.aprovador)
    get().editar(id, {
      status: 'Enviada',
      token,
      tokenExpiraEm: expiraEm,
    } as Partial<Solicitacao>)
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

  decidirPorToken: (token, acao, motivo) => {
    const validacao = validarTokenAprovacao(token)
    if (!validacao.valido || !validacao.idSolicitacao) {
      return { ok: false, erro: validacao.motivo ?? 'Token inválido' }
    }
    const alvo = get().solicitacoes.find((s) => s.id === validacao.idSolicitacao)
    if (!alvo) return { ok: false, erro: 'Solicitação não encontrada' }
    if (alvo.status !== 'Enviada') {
      return { ok: false, erro: 'Esta solicitação já foi decidida' }
    }
    get().editar(alvo.id, aplicarDecisao(acao, motivo))
    registrarLog({
      usuario: validacao.aprovador ?? 'desconhecido',
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
