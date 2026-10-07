import { create } from 'zustand'
import { gravarColecao, lerColecao, proximaSequencia } from '../data/repository'
import { calcularDiff, registrarLog } from '../lib/audit'
import { gerarId } from '../lib/codes'
import { agoraISO } from '../lib/format'
import type { Movimentacao } from '../types'
import { useAtivosStore } from './ativos'
import { useAuthStore } from './auth'
import type { Resultado } from './setores'

const COLECAO = 'MOVIMENTACOES'

function usuarioAtual(): string {
  return useAuthStore.getState().usuario?.email ?? 'sistema@empresa.com'
}

function registrarNaAuditoria(
  acao: 'CREATE' | 'UPDATE',
  id: string,
  antes: Movimentacao | null,
  depois: Movimentacao,
): void {
  registrarLog({
    usuario: usuarioAtual(),
    acao,
    tabela: 'MOVIMENTACOES',
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

export interface NovaMovimentacao {
  codigoAtivo: string
  setorDestino: string
  responsavelDestino: string
}

interface MovimentacoesState {
  movimentacoes: Movimentacao[]
  recarregar: () => void
  criar: (dados: NovaMovimentacao) => Resultado
  confirmar: (id: string) => Resultado
  cancelar: (id: string) => Resultado
}

export const useMovimentacoesStore = create<MovimentacoesState>((set, get) => ({
  movimentacoes: lerColecao<Movimentacao>(COLECAO),

  recarregar: () => set({ movimentacoes: lerColecao<Movimentacao>(COLECAO) }),

  criar: (dados) => {
    const ativo = useAtivosStore
      .getState()
      .ativos.find((a) => a.codigo === dados.codigoAtivo)
    if (!ativo) return { ok: false, erro: 'Ativo não encontrado.' }
    if (ativo.setor === dados.setorDestino) {
      return { ok: false, erro: 'O setor de destino é igual ao setor atual do ativo.' }
    }
    if (!dados.responsavelDestino.trim()) {
      return { ok: false, erro: 'Informe o responsável no destino.' }
    }
    const movimentacao: Movimentacao = {
      id: gerarId('MOV', proximaSequencia('MOV')),
      codigoAtivo: ativo.codigo,
      setorOrigem: ativo.setor,
      setorDestino: dados.setorDestino,
      responsavelDestino: dados.responsavelDestino.trim(),
      status: 'Pendente',
      criadoEm: agoraISO(),
      criadoPor: usuarioAtual(),
    }
    const proximas = [movimentacao, ...get().movimentacoes]
    gravarColecao(COLECAO, proximas)
    registrarNaAuditoria('CREATE', movimentacao.id, null, movimentacao)
    set({ movimentacoes: proximas })
    return { ok: true }
  },

  confirmar: (id) => {
    const alvo = get().movimentacoes.find((m) => m.id === id)
    if (!alvo || alvo.status !== 'Pendente') {
      return { ok: false, erro: 'Movimentação não está pendente.' }
    }
    const ativosStore = useAtivosStore.getState()
    const ativo = ativosStore.ativos.find((a) => a.codigo === alvo.codigoAtivo)
    if (!ativo) return { ok: false, erro: 'Ativo não existe mais.' }
    if (ativo.setor !== alvo.setorOrigem) {
      return {
        ok: false,
        erro: `O ativo já está em ${ativo.setor} — movimentação desatualizada.`,
      }
    }

    ativosStore.atualizar(alvo.codigoAtivo, { setor: alvo.setorDestino })

    const depois: Movimentacao = {
      ...alvo,
      status: 'Confirmada',
      confirmadoEm: agoraISO(),
      confirmadoPor: usuarioAtual(),
    }
    const proximas = get().movimentacoes.map((m) => (m.id === id ? depois : m))
    gravarColecao(COLECAO, proximas)
    registrarNaAuditoria('UPDATE', id, alvo, depois)
    set({ movimentacoes: proximas })
    return { ok: true }
  },

  cancelar: (id) => {
    const alvo = get().movimentacoes.find((m) => m.id === id)
    if (!alvo || alvo.status !== 'Pendente') {
      return { ok: false, erro: 'Movimentação não está pendente.' }
    }
    const depois: Movimentacao = {
      ...alvo,
      status: 'Cancelada',
      canceladoEm: agoraISO(),
      canceladoPor: usuarioAtual(),
    }
    const proximas = get().movimentacoes.map((m) => (m.id === id ? depois : m))
    gravarColecao(COLECAO, proximas)
    registrarNaAuditoria('UPDATE', id, alvo, depois)
    set({ movimentacoes: proximas })
    return { ok: true }
  },
}))
