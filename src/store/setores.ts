import { create } from 'zustand'
import { gravarColecao, lerColecao, proximaSequencia } from '../data/repository'
import { calcularDiff, registrarLog } from '../lib/audit'
import { SETORES as SETORES_PADRAO } from '../lib/codes'
import { gerarId } from '../lib/codes'
import type { Setor } from '../types'
import { useAuthStore } from './auth'

const COLECAO = 'SETORES'

export interface Resultado {
  ok: boolean
  erro?: string
}

function usuarioAtual(): string {
  return useAuthStore.getState().usuario?.email ?? 'sistema@empresa.com'
}

function carregarSetores(): Setor[] {
  const salvos = lerColecao<Setor>(COLECAO)
  if (salvos.length) return salvos
  const gerados = SETORES_PADRAO.map<Setor>((nome) => ({
    id: gerarId('SET', proximaSequencia('SET')),
    nome,
    responsavel: '',
    localizacao: '',
    ativo: true,
  }))
  gravarColecao(COLECAO, gerados)
  return gerados
}

function registrarNaAuditoria(
  acao: 'CREATE' | 'UPDATE',
  id: string,
  antes: Setor | null,
  depois: Setor,
): void {
  registrarLog({
    usuario: usuarioAtual(),
    acao,
    tabela: 'SETORES',
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

interface SetoresState {
  setores: Setor[]
  criar: (dados: { nome: string; responsavel: string; localizacao: string }) => Resultado
  editar: (
    id: string,
    campos: { nome: string; responsavel: string; localizacao: string },
  ) => Resultado
  alternarStatus: (id: string) => void
}

export const useSetoresStore = create<SetoresState>((set, get) => ({
  setores: carregarSetores(),

  criar: (dados) => {
    const nome = dados.nome.trim()
    if (get().setores.some((s) => s.nome.toLowerCase() === nome.toLowerCase())) {
      return { ok: false, erro: 'Já existe um setor com esse nome.' }
    }
    const setor: Setor = {
      id: gerarId('SET', proximaSequencia('SET')),
      nome,
      responsavel: dados.responsavel.trim(),
      localizacao: dados.localizacao.trim(),
      ativo: true,
    }
    const proximos = [...get().setores, setor]
    gravarColecao(COLECAO, proximos)
    registrarNaAuditoria('CREATE', setor.id, null, setor)
    set({ setores: proximos })
    return { ok: true }
  },

  editar: (id, campos) => {
    const alvo = get().setores.find((s) => s.id === id)
    if (!alvo) return { ok: false, erro: 'Setor não encontrado.' }
    const nome = campos.nome.trim()
    if (
      get().setores.some(
        (s) => s.id !== id && s.nome.toLowerCase() === nome.toLowerCase(),
      )
    ) {
      return { ok: false, erro: 'Já existe um setor com esse nome.' }
    }
    const depois: Setor = {
      ...alvo,
      nome,
      responsavel: campos.responsavel.trim(),
      localizacao: campos.localizacao.trim(),
    }
    const proximos = get().setores.map((s) => (s.id === id ? depois : s))
    gravarColecao(COLECAO, proximos)
    registrarNaAuditoria('UPDATE', id, alvo, depois)
    set({ setores: proximos })
    return { ok: true }
  },

  alternarStatus: (id) => {
    const alvo = get().setores.find((s) => s.id === id)
    if (!alvo) return
    const depois: Setor = { ...alvo, ativo: !alvo.ativo }
    const proximos = get().setores.map((s) => (s.id === id ? depois : s))
    gravarColecao(COLECAO, proximos)
    registrarNaAuditoria('UPDATE', id, alvo, depois)
    set({ setores: proximos })
  },
}))
