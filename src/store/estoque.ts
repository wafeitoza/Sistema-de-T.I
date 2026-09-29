import { create } from 'zustand'
import { gravarColecao, lerColecao, proximaSequencia } from '../data/repository'
import { calcularDiff, registrarLog } from '../lib/audit'
import { proximoCodigoItem } from '../lib/codes'
import { hojeBR } from '../lib/format'
import { useAuthStore } from './auth'
import type {
  Entrada,
  ItemEstoque,
  Saida,
  StatusEstoque,
  TipoEntrada,
  TipoSaida,
} from '../types'

const ITENS = 'ESTOQUE'
const ENTRADAS = 'ENTRADAS'
const SAIDAS = 'SAIDAS'

function usuarioAtual(): string {
  return useAuthStore.getState().usuario?.email ?? 'sistema@empresa.com'
}

export function statusEstoque(item: ItemEstoque): StatusEstoque {
  if (item.quantidade <= 0) return 'Zerado'
  if (item.quantidade < item.quantidadeMinima) return 'Baixo'
  return 'Normal'
}

export interface ResultadoMovimento {
  ok: boolean
  erro?: string
}

export interface NovoItem {
  descricao: string
  categoria: string
  quantidadeMinima: number
  unidade: string
  fornecedor?: string
  precoUnitario?: number
  notas?: string
}

export interface DadosEntrada {
  codigoItem: string
  quantidade: number
  tipo: TipoEntrada
  precoUnitario?: number
  fornecedor?: string
  nf?: string
  notas?: string
}

export interface DadosSaida {
  codigoItem: string
  quantidade: number
  tipo: TipoSaida
  responsavel: string
  motivo?: string
  observacoes?: string
}

interface EstoqueState {
  itens: ItemEstoque[]
  entradas: Entrada[]
  saidas: Saida[]
  recarregar: () => void
  criarItem: (dados: NovoItem) => ItemEstoque
  atualizarItem: (codigo: string, campos: Partial<ItemEstoque>) => void
  registrarEntrada: (dados: DadosEntrada) => ResultadoMovimento
  registrarSaida: (dados: DadosSaida) => ResultadoMovimento
}

function atualizarItemNaColecao(
  itens: ItemEstoque[],
  codigo: string,
  campos: Partial<ItemEstoque>,
): ItemEstoque[] {
  return itens.map((i) => (i.codigo === codigo ? { ...i, ...campos } : i))
}

export const useEstoqueStore = create<EstoqueState>((set, get) => ({
  itens: lerColecao<ItemEstoque>(ITENS),
  entradas: lerColecao<Entrada>(ENTRADAS),
  saidas: lerColecao<Saida>(SAIDAS),

  recarregar: () =>
    set({
      itens: lerColecao<ItemEstoque>(ITENS),
      entradas: lerColecao<Entrada>(ENTRADAS),
      saidas: lerColecao<Saida>(SAIDAS),
    }),

  criarItem: (dados) => {
    const itens = get().itens
    const codigo = proximoCodigoItem(itens.map((i) => i.codigo))
    const item: ItemEstoque = { ...dados, codigo, quantidade: 0 }
    const proximos = [...itens, item]
    gravarColecao(ITENS, proximos)
    registrarLog({
      usuario: usuarioAtual(),
      acao: 'CREATE',
      tabela: 'ESTOQUE',
      registroId: codigo,
      campos: Object.entries(item).map(([campo, valor]) => ({
        campo,
        antes: null,
        depois: valor,
      })),
    })
    set({ itens: proximos })
    return item
  },

  atualizarItem: (codigo, campos) => {
    const itens = get().itens
    const alvo = itens.find((i) => i.codigo === codigo)
    if (!alvo) return
    const proximos = atualizarItemNaColecao(itens, codigo, campos)
    gravarColecao(ITENS, proximos)
    registrarLog({
      usuario: usuarioAtual(),
      acao: 'UPDATE',
      tabela: 'ESTOQUE',
      registroId: codigo,
      campos: calcularDiff(
        alvo as unknown as Record<string, unknown>,
        { ...alvo, ...campos } as unknown as Record<string, unknown>,
      ),
    })
    set({ itens: proximos })
  },

  registrarEntrada: (dados) => {
    if (dados.quantidade <= 0) {
      return { ok: false, erro: 'A quantidade deve ser maior que zero' }
    }
    const itens = get().itens
    const item = itens.find((i) => i.codigo === dados.codigoItem)
    if (!item) return { ok: false, erro: 'Item não encontrado' }

    const novaQuantidade = item.quantidade + dados.quantidade
    const proximos = atualizarItemNaColecao(itens, item.codigo, {
      quantidade: novaQuantidade,
    })
    const entrada: Entrada = {
      id: `EDD-${new Date().getFullYear()}-${String(proximaSequencia('EDD')).padStart(6, '0')}`,
      data: hojeBR(),
      usuario: usuarioAtual(),
      ...dados,
    }
    const entradas = [entrada, ...get().entradas]
    gravarColecao(ITENS, proximos)
    gravarColecao(ENTRADAS, entradas)
    registrarLog({
      usuario: usuarioAtual(),
      acao: 'CREATE',
      tabela: 'ENTRADAS',
      registroId: entrada.id,
      campos: [{ campo: 'quantidade', antes: item.quantidade, depois: novaQuantidade }],
    })
    set({ itens: proximos, entradas })
    return { ok: true }
  },

  registrarSaida: (dados) => {
    if (dados.quantidade <= 0) {
      return { ok: false, erro: 'A quantidade deve ser maior que zero' }
    }
    const itens = get().itens
    const item = itens.find((i) => i.codigo === dados.codigoItem)
    if (!item) return { ok: false, erro: 'Item não encontrado' }
    if (dados.quantidade > item.quantidade) {
      return {
        ok: false,
        erro: `Estoque insuficiente: disponível ${item.quantidade}, solicitado ${dados.quantidade}`,
      }
    }

    const novaQuantidade = item.quantidade - dados.quantidade
    const proximos = atualizarItemNaColecao(itens, item.codigo, {
      quantidade: novaQuantidade,
    })
    const saida: Saida = {
      id: `SAD-${new Date().getFullYear()}-${String(proximaSequencia('SAD')).padStart(6, '0')}`,
      data: hojeBR(),
      usuario: usuarioAtual(),
      ...dados,
    }
    const saidas = [saida, ...get().saidas]
    gravarColecao(ITENS, proximos)
    gravarColecao(SAIDAS, saidas)
    registrarLog({
      usuario: usuarioAtual(),
      acao: 'CREATE',
      tabela: 'SAIDAS',
      registroId: saida.id,
      campos: [{ campo: 'quantidade', antes: item.quantidade, depois: novaQuantidade }],
    })
    set({ itens: proximos, saidas })
    return { ok: true }
  },
}))
