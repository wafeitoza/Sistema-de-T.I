import { create } from 'zustand'
import { gravarColecao, lerColecao, proximaSequencia } from '../data/repository'
import { calcularDiff, registrarLog } from '../lib/audit'
import { gerarId } from '../lib/codes'
import { agoraISO } from '../lib/format'
import { useAuthStore } from './auth'
import type { Resultado } from './setores'
import type { Chamado, ChamadoMensagem, Perfil, PrioridadeChamado, StatusChamado } from '../types'

const COLECAO = 'CHAMADOS'
const COLECAO_MENSAGENS = 'CHAMADO_MENSAGENS'

export const STATUS_CHAMADO: StatusChamado[] = [
  'Aberto',
  'Em atendimento',
  'Aguardando usuário',
  'Resolvido',
  'Cancelado',
]

export const PRIORIDADES_CHAMADO: PrioridadeChamado[] = ['Baixa', 'Média', 'Alta', 'Crítica']

function usuarioAtual(): string {
  return useAuthStore.getState().usuario?.email ?? 'sistema@empresa.com'
}

function registrarNaAuditoria(
  acao: 'CREATE' | 'UPDATE',
  id: string,
  antes: Chamado | null,
  depois: Chamado,
): void {
  registrarLog({
    usuario: usuarioAtual(),
    acao,
    tabela: 'CHAMADOS',
    registroId: id,
    campos: antes
      ? calcularDiff(
          antes as unknown as Record<string, unknown>,
          depois as unknown as Record<string, unknown>,
        )
      : Object.entries(depois).map(([campo, valor]) => ({ campo, antes: null, depois: valor })),
  })
}

export interface DadosChamado {
  assunto: string
  descricao: string
  solicitante: string
  prioridade: PrioridadeChamado
}

interface ChamadosState {
  chamados: Chamado[]
  mensagens: ChamadoMensagem[]
  recarregar: () => void
  abrir: (dados: DadosChamado) => Resultado
  atribuir: (id: string, atribuidoA: string) => Resultado
  mudarStatus: (id: string, status: StatusChamado) => Resultado
  mudarPrioridade: (id: string, prioridade: PrioridadeChamado) => Resultado
  anexarMensagem: (mensagem: ChamadoMensagem) => void
  substituirMensagens: (chamadoId: string, mensagens: ChamadoMensagem[]) => void
}

/**
 * Transições permitidas.
 *
 * 'Resolvido' volta para 'Em atendimento' de propósito: resolver por engano é
 * comum e a alternativa (abrir chamado novo) perde o histórico. 'Cancelado' é
 * terminal porque existe só para corrigir lançamento incorreto.
 */
const TRANSICOES: Record<StatusChamado, StatusChamado[]> = {
  Aberto: ['Em atendimento', 'Aguardando usuário', 'Resolvido', 'Cancelado'],
  'Em atendimento': ['Aberto', 'Aguardando usuário', 'Resolvido', 'Cancelado'],
  'Aguardando usuário': ['Em atendimento', 'Resolvido', 'Cancelado'],
  Resolvido: ['Em atendimento'],
  Cancelado: [],
}

export function transicaoPermitida(de: StatusChamado, para: StatusChamado): boolean {
  return TRANSICOES[de]?.includes(para) ?? false
}

/** Somente quem opera a fila muda chamado (mesmo recorte do RLS). */
export function perfilOperaChamados(perfil: Perfil | undefined): boolean {
  return perfil === 'Admin' || perfil === 'Gerente' || perfil === 'Técnico'
}

export const useChamadosStore = create<ChamadosState>((set, get) => ({
  chamados: lerColecao<Chamado>(COLECAO),
  mensagens: lerColecao<ChamadoMensagem>(COLECAO_MENSAGENS),

  recarregar: () =>
    set({
      chamados: lerColecao<Chamado>(COLECAO),
      mensagens: lerColecao<ChamadoMensagem>(COLECAO_MENSAGENS),
    }),

  abrir: (dados) => {
    if (!perfilOperaChamados(useAuthStore.getState().usuario?.perfil)) {
      return { ok: false, erro: 'Seu perfil não abre chamados.' }
    }

    const assunto = dados.assunto.trim()
    const solicitante = dados.solicitante.trim().toLowerCase()
    if (assunto.length < 3) return { ok: false, erro: 'Descreva o chamado em poucas palavras.' }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(solicitante)) {
      return { ok: false, erro: 'Informe um e-mail válido para o solicitante.' }
    }

    const agora = agoraISO()
    const novo: Chamado = {
      id: gerarId('CHM', proximaSequencia('CHM')),
      assunto,
      descricao: dados.descricao.trim() || undefined,
      solicitante,
      origem: 'Manual',
      prioridade: dados.prioridade,
      status: 'Aberto',
      registradoPor: usuarioAtual(),
      criadoEm: agora,
      atualizadoEm: agora,
    }

    const proximos = [novo, ...get().chamados]
    gravarColecao(COLECAO, proximos)
    registrarNaAuditoria('CREATE', novo.id, null, novo)
    set({ chamados: proximos })
    return { ok: true }
  },

  atribuir: (id, atribuidoA) => {
    const email = atribuidoA.trim().toLowerCase()
    if (!email) return { ok: false, erro: 'Selecione quem vai atender.' }

    const alvo = get().chamados.find((c) => c.id === id)
    if (!alvo) return { ok: false, erro: 'Chamado não encontrado.' }

    const depois: Chamado = {
      ...alvo,
      atribuidoA: email,
      // atribuir um chamado em aberto já é assumir o atendimento — sem isto
      // a fila ficaria com chamado 'Aberto' e responsável, que a tela não
      // sabe onde mostrar.
      status: alvo.status === 'Aberto' ? 'Em atendimento' : alvo.status,
      atualizadoEm: agoraISO(),
    }

    const proximos = get().chamados.map((c) => (c.id === id ? depois : c))
    gravarColecao(COLECAO, proximos)
    registrarNaAuditoria('UPDATE', id, alvo, depois)
    set({ chamados: proximos })
    return { ok: true }
  },

  mudarStatus: (id, status) => {
    if (!perfilOperaChamados(useAuthStore.getState().usuario?.perfil)) {
      return { ok: false, erro: 'Seu perfil não mexe em chamados.' }
    }
    const alvo = get().chamados.find((c) => c.id === id)
    if (!alvo) return { ok: false, erro: 'Chamado não encontrado.' }
    if (alvo.status === status) return { ok: true }
    if (!transicaoPermitida(alvo.status, status)) {
      return { ok: false, erro: `Não dá para ir de "${alvo.status}" para "${status}".` }
    }

    const agora = agoraISO()
    const depois: Chamado = {
      ...alvo,
      status,
      atualizadoEm: agora,
      resolvidoEm: status === 'Resolvido' ? agora : undefined,
      resolvidoPor: status === 'Resolvido' ? usuarioAtual() : undefined,
      canceladoPor: status === 'Cancelado' ? usuarioAtual() : undefined,
    }

    // a trava do banco exige responsável para 'Em atendimento' e para
    // 'Resolvido'; melhor avisar aqui do que deixar o sync falhar em silêncio
    if (status === 'Em atendimento' && !depois.atribuidoA) {
      return { ok: false, erro: 'Informe quem vai atender antes de assumir o chamado.' }
    }

    const proximos = get().chamados.map((c) => (c.id === id ? depois : c))
    gravarColecao(COLECAO, proximos)
    registrarNaAuditoria('UPDATE', id, alvo, depois)
    set({ chamados: proximos })
    return { ok: true }
  },

  mudarPrioridade: (id, prioridade) => {
    const alvo = get().chamados.find((c) => c.id === id)
    if (!alvo) return { ok: false, erro: 'Chamado não encontrado.' }
    if (alvo.prioridade === prioridade) return { ok: true }

    const depois: Chamado = { ...alvo, prioridade, atualizadoEm: agoraISO() }
    const proximos = get().chamados.map((c) => (c.id === id ? depois : c))
    gravarColecao(COLECAO, proximos)
    registrarNaAuditoria('UPDATE', id, alvo, depois)
    set({ chamados: proximos })
    return { ok: true }
  },

  anexarMensagem: (mensagem) => {
    const existe = get().mensagens.some((m) => m.id === mensagem.id)
    if (existe) return
    const proximas = [mensagem, ...get().mensagens]
    gravarColecao(COLECAO_MENSAGENS, proximas)
    set({ mensagens: proximas })
  },

  substituirMensagens: (chamadoId, mensagens) => {
    const mantidas = get().mensagens.filter((m) => m.chamadoId !== chamadoId)
    const proximas = [...mensagens, ...mantidas]
    gravarColecao(COLECAO_MENSAGENS, proximas)
    set({ mensagens: proximas })
  },
}))

/** Chamados que alguém ainda precisa olhar. */
export function chamadosPendentes(chamados: Chamado[]): Chamado[] {
  return chamados.filter((c) => c.status === 'Aberto' || c.status === 'Aguardando usuário')
}

export function mensagensDo(mensagens: ChamadoMensagem[], chamadoId: string): ChamadoMensagem[] {
  return mensagens
    .filter((m) => m.chamadoId === chamadoId)
    .sort((a, b) => (a.recebidoEm > b.recebidoEm ? 1 : -1))
}
