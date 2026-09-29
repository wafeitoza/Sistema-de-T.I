import { create } from 'zustand'
import { gravarColecao, lerColecao, proximaSequencia } from '../data/repository'
import { calcularDiff, registrarLog } from '../lib/audit'
import { agoraISO, hojeBR, somarDiasBR } from '../lib/format'
import { useAtivosStore } from './ativos'
import { useAuthStore } from './auth'
import type { Manutencao, TipoManutencao } from '../types'

const COLECAO = 'MANUTENCOES'
const INTERVALO_PREVENTIVA_DIAS = 90

function usuarioAtual(): string {
  return useAuthStore.getState().usuario?.email ?? 'sistema@empresa.com'
}

export interface NovaManutencao {
  codigoAtivo: string
  tipo: TipoManutencao
  dataAgendada: string
  tecnico: string
  descricao: string
}

interface ManutencoesState {
  manutencoes: Manutencao[]
  recarregar: () => void
  agendar: (dados: NovaManutencao) => Manutencao
  iniciar: (id: string) => void
  concluir: (id: string, campos: { resultado?: string; custo?: number }) => void
  cancelar: (id: string) => void
}

function persistir(manutencoes: Manutencao[]): void {
  gravarColecao(COLECAO, manutencoes)
}

function registrarNaAuditoria(
  acao: 'CREATE' | 'UPDATE',
  id: string,
  antes: Manutencao | null,
  depois: Manutencao,
): void {
  registrarLog({
    usuario: usuarioAtual(),
    acao,
    tabela: 'MANUTENCOES',
    registroId: id,
    campos: antes
      ? calcularDiff(
          antes as unknown as Record<string, unknown>,
          depois as unknown as Record<string, unknown>,
        )
      : Object.entries(depois).map(([campo, valor]) => ({
          campo,
          antes: null,
          depois: valor,
        })),
  })
}

export const useManutencoesStore = create<ManutencoesState>((set, get) => ({
  manutencoes: lerColecao<Manutencao>(COLECAO),

  recarregar: () => set({ manutencoes: lerColecao<Manutencao>(COLECAO) }),

  agendar: (dados) => {
    const manutencao: Manutencao = {
      id: `MAN-${new Date().getFullYear()}-${String(proximaSequencia('MAN')).padStart(6, '0')}`,
      status: 'Agendada',
      criadoEm: agoraISO(),
      atualizadoEm: agoraISO(),
      ...dados,
    }
    const proximas = [manutencao, ...get().manutencoes]
    persistir(proximas)
    registrarNaAuditoria('CREATE', manutencao.id, null, manutencao)
    useAtivosStore.getState().mudarStatus(dados.codigoAtivo, 'Manutenção')
    set({ manutencoes: proximas })
    return manutencao
  },

  iniciar: (id) => {
    const atual = get().manutencoes
    const alvo = atual.find((m) => m.id === id)
    if (!alvo || alvo.status !== 'Agendada') return
    const proximo: Manutencao = {
      ...alvo,
      status: 'Em Execução',
      atualizadoEm: agoraISO(),
    }
    const proximas = atual.map((m) => (m.id === id ? proximo : m))
    persistir(proximas)
    registrarNaAuditoria('UPDATE', id, alvo, proximo)
    set({ manutencoes: proximas })
  },

  concluir: (id, campos) => {
    const atual = get().manutencoes
    const alvo = atual.find((m) => m.id === id)
    if (!alvo || alvo.status === 'Concluída' || alvo.status === 'Cancelada') return

    const dataRealizada = hojeBR()
    const proximo: Manutencao = {
      ...alvo,
      status: 'Concluída',
      dataRealizada,
      resultado: campos.resultado || 'OK',
      custo: campos.custo,
      proximaData: somarDiasBR(dataRealizada, INTERVALO_PREVENTIVA_DIAS),
      atualizadoEm: agoraISO(),
    }
    const proximas = atual.map((m) => (m.id === id ? proximo : m))
    persistir(proximas)
    registrarNaAuditoria('UPDATE', id, alvo, proximo)

    useAtivosStore.getState().mudarStatus(alvo.codigoAtivo, 'Ativo')
    useAtivosStore.getState().registrarManutencao(alvo.codigoAtivo, dataRealizada)
    set({ manutencoes: proximas })
  },

  cancelar: (id) => {
    const atual = get().manutencoes
    const alvo = atual.find((m) => m.id === id)
    if (!alvo || alvo.status === 'Concluída' || alvo.status === 'Cancelada') return
    const proximo: Manutencao = {
      ...alvo,
      status: 'Cancelada',
      atualizadoEm: agoraISO(),
    }
    const proximas = atual.map((m) => (m.id === id ? proximo : m))
    persistir(proximas)
    registrarNaAuditoria('UPDATE', id, alvo, proximo)
    useAtivosStore.getState().mudarStatus(alvo.codigoAtivo, 'Ativo')
    set({ manutencoes: proximas })
  },
}))
