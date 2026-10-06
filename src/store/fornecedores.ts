import { create } from 'zustand'
import { gravarColecao, lerColecao, proximaSequencia } from '../data/repository'
import { calcularDiff, registrarLog } from '../lib/audit'
import { gerarId } from '../lib/codes'
import type { Fornecedor, ItemEstoque } from '../types'
import { useAuthStore } from './auth'

const COLECAO = 'FORNECEDORES'

export interface Resultado {
  ok: boolean
  erro?: string
}

function usuarioAtual(): string {
  return useAuthStore.getState().usuario?.email ?? 'sistema@empresa.com'
}

function carregarFornecedores(): Fornecedor[] {
  const salvos = lerColecao<Fornecedor>(COLECAO)
  if (salvos.length) return salvos
  const nomes = Array.from(
    new Set(
      lerColecao<ItemEstoque>('ESTOQUE')
        .map((i) => i.fornecedor?.trim())
        .filter((n): n is string => !!n),
    ),
  )
  const gerados = nomes.map<Fornecedor>((nome) => ({
    id: gerarId('FOR', proximaSequencia('FOR')),
    nome,
    cnpj: '',
    ativo: true,
  }))
  if (gerados.length) gravarColecao(COLECAO, gerados)
  return gerados
}

function registrarNaAuditoria(
  acao: 'CREATE' | 'UPDATE' | 'DELETE',
  id: string,
  antes: Fornecedor | null,
  depois: Fornecedor | null,
): void {
  registrarLog({
    usuario: usuarioAtual(),
    acao,
    tabela: 'FORNECEDORES',
    registroId: id,
    campos: acao === 'DELETE'
      ? Object.entries(antes ?? {}).map(([campo, valor]) => ({
          campo,
          antes: valor,
          depois: null,
        }))
      : antes
        ? calcularDiff(
            antes as unknown as Record<string, unknown>,
            depois as unknown as Record<string, unknown>,
          )
        : Object.entries(depois ?? {}).map(([campo, valor]) => ({
            campo,
            antes: null,
            depois: valor,
          })),
  })
}

export interface DadosFornecedor {
  nome: string
  cnpj: string
  email: string
  telefone: string
}

interface FornecedoresState {
  fornecedores: Fornecedor[]
  criar: (dados: DadosFornecedor) => Resultado
  editar: (id: string, dados: DadosFornecedor) => Resultado
  alternarStatus: (id: string) => void
  excluir: (id: string) => Resultado
}

export const useFornecedoresStore = create<FornecedoresState>((set, get) => ({
  fornecedores: carregarFornecedores(),

  criar: (dados) => {
    const nome = dados.nome.trim()
    if (!nome) return { ok: false, erro: 'Informe a razão social.' }
    if (get().fornecedores.some((f) => f.nome.toLowerCase() === nome.toLowerCase())) {
      return { ok: false, erro: 'Já existe um fornecedor com esse nome.' }
    }
    const fornecedor: Fornecedor = {
      id: gerarId('FOR', proximaSequencia('FOR')),
      nome,
      cnpj: dados.cnpj.trim(),
      email: dados.email.trim() || undefined,
      telefone: dados.telefone.trim() || undefined,
      ativo: true,
    }
    const proximos = [...get().fornecedores, fornecedor]
    gravarColecao(COLECAO, proximos)
    registrarNaAuditoria('CREATE', fornecedor.id, null, fornecedor)
    set({ fornecedores: proximos })
    return { ok: true }
  },

  editar: (id, dados) => {
    const alvo = get().fornecedores.find((f) => f.id === id)
    if (!alvo) return { ok: false, erro: 'Fornecedor não encontrado.' }
    const nome = dados.nome.trim()
    if (!nome) return { ok: false, erro: 'Informe a razão social.' }
    if (
      get().fornecedores.some(
        (f) => f.id !== id && f.nome.toLowerCase() === nome.toLowerCase(),
      )
    ) {
      return { ok: false, erro: 'Já existe um fornecedor com esse nome.' }
    }
    const depois: Fornecedor = {
      ...alvo,
      nome,
      cnpj: dados.cnpj.trim(),
      email: dados.email.trim() || undefined,
      telefone: dados.telefone.trim() || undefined,
    }
    const proximos = get().fornecedores.map((f) => (f.id === id ? depois : f))
    gravarColecao(COLECAO, proximos)
    registrarNaAuditoria('UPDATE', id, alvo, depois)
    set({ fornecedores: proximos })
    return { ok: true }
  },

  alternarStatus: (id) => {
    const alvo = get().fornecedores.find((f) => f.id === id)
    if (!alvo) return
    const depois: Fornecedor = { ...alvo, ativo: !alvo.ativo }
    const proximos = get().fornecedores.map((f) => (f.id === id ? depois : f))
    gravarColecao(COLECAO, proximos)
    registrarNaAuditoria('UPDATE', id, alvo, depois)
    set({ fornecedores: proximos })
  },

  excluir: (id) => {
    const alvo = get().fornecedores.find((f) => f.id === id)
    if (!alvo) return { ok: false, erro: 'Fornecedor não encontrado.' }

    const emUso = lerColecao<ItemEstoque>('ESTOQUE').filter(
      (i) => i.fornecedor?.trim().toLowerCase() === alvo.nome.trim().toLowerCase(),
    )
    if (emUso.length > 0) {
      return {
        ok: false,
        erro: `${alvo.nome} está vinculado a ${emUso.length} item(ns) de estoque. Desative o fornecedor em vez de excluir.`,
      }
    }

    const proximos = get().fornecedores.filter((f) => f.id !== id)
    gravarColecao(COLECAO, proximos)
    registrarNaAuditoria('DELETE', id, alvo, null)
    set({ fornecedores: proximos })
    return { ok: true }
  },
}))
