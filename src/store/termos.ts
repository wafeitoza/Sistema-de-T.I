import { create } from 'zustand'
import { gravarColecao, lerColecao, proximaSequencia } from '../data/repository'
import { calcularDiff, registrarLog } from '../lib/audit'
import { gerarId } from '../lib/codes'
import { agoraISO } from '../lib/format'
import { calcularHashTermo } from '../lib/termos'
import type { Termo } from '../types'
import { useAuthStore } from './auth'

const COLECAO = 'TERMOS'

function usuarioAtual(): string {
  return useAuthStore.getState().usuario?.email ?? 'sistema@empresa.com'
}

export interface NovoTermo {
  ativoCodigo: string
  responsavel: string
  conteudo: string
}

interface TermosState {
  termos: Termo[]
  recarregar: () => void
  criar: (dados: NovoTermo) => Promise<Termo>
  assinar: (id: string) => void
  revogar: (id: string) => void
}

function persistir(termos: Termo[]): void {
  gravarColecao(COLECAO, termos)
}

function registrarNaAuditoria(
  acao: 'CREATE' | 'UPDATE',
  id: string,
  antes: Termo | null,
  depois: Termo,
): void {
  registrarLog({
    usuario: usuarioAtual(),
    acao,
    tabela: 'TERMOS',
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

export const useTermosStore = create<TermosState>((set, get) => ({
  termos: lerColecao<Termo>(COLECAO),

  recarregar: () => set({ termos: lerColecao<Termo>(COLECAO) }),

  criar: async (dados) => {
    const base: Termo = {
      id: gerarId('TERM', proximaSequencia('TERM')),
      status: 'Pendente',
      criadoEm: agoraISO(),
      criadoPor: usuarioAtual(),
      hash: '',
      ...dados,
    }
    const termo: Termo = { ...base, hash: await calcularHashTermo(base) }
    const proximos = [termo, ...get().termos]
    persistir(proximos)
    registrarNaAuditoria('CREATE', termo.id, null, termo)
    set({ termos: proximos })
    return termo
  },

  assinar: (id) => {
    const alvo = get().termos.find((t) => t.id === id)
    if (!alvo || alvo.status !== 'Pendente') return
    const depois: Termo = {
      ...alvo,
      status: 'Assinado',
      assinadoEm: agoraISO(),
      assinadoPor: usuarioAtual(),
    }
    const proximos = get().termos.map((t) => (t.id === id ? depois : t))
    persistir(proximos)
    registrarNaAuditoria('UPDATE', id, alvo, depois)
    set({ termos: proximos })
  },

  revogar: (id) => {
    const alvo = get().termos.find((t) => t.id === id)
    if (!alvo || alvo.status !== 'Assinado') return
    const depois: Termo = {
      ...alvo,
      status: 'Revogado',
      revogadoEm: agoraISO(),
      revogadoPor: usuarioAtual(),
    }
    const proximos = get().termos.map((t) => (t.id === id ? depois : t))
    persistir(proximos)
    registrarNaAuditoria('UPDATE', id, alvo, depois)
    set({ termos: proximos })
  },
}))
