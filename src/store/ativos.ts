import { create } from 'zustand'
import { gravarColecao, lerColecao } from '../data/repository'
import { calcularDiff, registrarLog } from '../lib/audit'
import { proximoCodigoAtivo, urlQRCode } from '../lib/codes'
import { agoraISO, somarDiasBR } from '../lib/format'
import { useAuthStore } from './auth'
import type { Ativo, StatusAtivo } from '../types'

const COLECAO = 'ATIVOS'

function usuarioAtual(): string {
  return useAuthStore.getState().usuario?.email ?? 'sistema@empresa.com'
}

function persistir(ativos: Ativo[]): void {
  gravarColecao(COLECAO, ativos)
}

export interface NovoAtivo {
  descricao: string
  tipo: string
  marca?: string
  modelo?: string
  serial?: string
  setor: string
  responsavel: string
  dataAquisicao: string
  valorAquisicao?: number
  localizacao?: string
  notas?: string
}

interface AtivosState {
  ativos: Ativo[]
  recarregar: () => void
  criar: (dados: NovoAtivo) => Ativo
  atualizar: (codigo: string, campos: Partial<Ativo>) => void
  mudarStatus: (codigo: string, status: StatusAtivo) => void
  registrarManutencao: (codigo: string, data: string) => void
  proximoCodigo: (tipo: string) => string
}

export const useAtivosStore = create<AtivosState>((set, get) => ({
  ativos: lerColecao<Ativo>(COLECAO),

  recarregar: () => set({ ativos: lerColecao<Ativo>(COLECAO) }),

  proximoCodigo: (tipo) => proximoCodigoAtivo(tipo, get().ativos.map((a) => a.codigo)),

  criar: (dados) => {
    const ativos = get().ativos
    const codigo = proximoCodigoAtivo(dados.tipo, ativos.map((a) => a.codigo))
    const ativo: Ativo = {
      ...dados,
      codigo,
      status: 'Ativo',
      qrUrl: urlQRCode(codigo),
      criadoEm: agoraISO(),
      atualizadoEm: agoraISO(),
    }
    const proximos = [...ativos, ativo]
    persistir(proximos)
    registrarLog({
      usuario: usuarioAtual(),
      acao: 'CREATE',
      tabela: 'ATIVOS',
      registroId: codigo,
      campos: Object.entries(ativo).map(([campo, valor]) => ({
        campo,
        antes: null,
        depois: valor,
      })),
    })
    set({ ativos: proximos })
    return ativo
  },

  atualizar: (codigo, campos) => {
    const ativos = get().ativos
    const alvo = ativos.find((a) => a.codigo === codigo)
    if (!alvo) return
    const atualizado: Ativo = { ...alvo, ...campos, atualizadoEm: agoraISO() }
    const proximos = ativos.map((a) => (a.codigo === codigo ? atualizado : a))
    persistir(proximos)
    registrarLog({
      usuario: usuarioAtual(),
      acao: 'UPDATE',
      tabela: 'ATIVOS',
      registroId: codigo,
      campos: calcularDiff(
        alvo as unknown as Record<string, unknown>,
        atualizado as unknown as Record<string, unknown>,
      ),
    })
    set({ ativos: proximos })
  },

  mudarStatus: (codigo, status) => {
    get().atualizar(codigo, { status })
  },

  registrarManutencao: (codigo, data) => {
    get().atualizar(codigo, {
      ultimaManutencao: data,
      proximaManutencao: somarDiasBR(data, 90),
    })
  },
}))
