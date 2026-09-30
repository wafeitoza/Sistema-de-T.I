import { create } from 'zustand'
import { gravarColecao, lerColecao, proximaSequencia } from '../data/repository'
import { calcularDiff, registrarLog } from '../lib/audit'
import { gerarId } from '../lib/codes'
import { agoraISO, hojeBR } from '../lib/format'
import { useAuthStore } from './auth'
import { useEstoqueStore } from './estoque'
import type { Contagem } from '../types'

const CONTAGENS = 'CONTAGENS'

function usuarioAtual(): string {
  return useAuthStore.getState().usuario?.email ?? 'sistema@empresa.com'
}

export interface ResultadoConclusao {
  ok: boolean
  erro?: string
  ajustes?: number
  divergentes?: number
  pendentes?: number
  falhas?: number
}

interface InventarioState {
  contagens: Contagem[]
  recarregar: () => void
  criarContagem: (nome: string, codigos: string[]) => Contagem | null
  registrarContagem: (
    id: string,
    codigoItem: string,
    contado: number | null,
  ) => { ok: boolean; erro?: string }
  excluirContagem: (id: string) => boolean
  concluirContagem: (id: string) => ResultadoConclusao
}

export const useInventarioStore = create<InventarioState>((set, get) => ({
  contagens: lerColecao<Contagem>(CONTAGENS),

  recarregar: () => set({ contagens: lerColecao<Contagem>(CONTAGENS) }),

  criarContagem: (nome, codigos) => {
    if (!nome.trim() || codigos.length === 0) return null
    const id = gerarId('INV', proximaSequencia('INV'))
    const agora = agoraISO()
    const contagem: Contagem = {
      id,
      nome: nome.trim(),
      data: hojeBR(),
      status: 'Em andamento',
      responsavel: usuarioAtual(),
      itens: codigos.map((codigoItem) => ({ codigoItem, contado: null })),
      ajustesGerados: 0,
      criadoEm: agora,
    }
    const proximas = [contagem, ...get().contagens]
    gravarColecao(CONTAGENS, proximas)
    registrarLog({
      usuario: usuarioAtual(),
      acao: 'CREATE',
      tabela: 'CONTAGEM',
      registroId: id,
      campos: [
        { campo: 'nome', antes: null, depois: contagem.nome },
        { campo: 'itens', antes: null, depois: codigos.length },
      ],
    })
    set({ contagens: proximas })
    return contagem
  },

  registrarContagem: (id, codigoItem, contado) => {
    if (contado !== null && (Number.isNaN(contado) || contado < 0 || !Number.isInteger(contado))) {
      return { ok: false, erro: 'A quantidade contada deve ser um inteiro maior ou igual a zero' }
    }
    const contagens = get().contagens
    const contagem = contagens.find((c) => c.id === id)
    if (!contagem) return { ok: false, erro: 'Contagem não encontrada' }
    if (contagem.status !== 'Em andamento') {
      return { ok: false, erro: 'Esta contagem já foi concluída' }
    }
    const alvo = contagem.itens.find((i) => i.codigoItem === codigoItem)
    if (!alvo) return { ok: false, erro: 'Item fora desta contagem' }

    const proximas = contagens.map((c) =>
      c.id === id
        ? {
            ...c,
            itens: c.itens.map((i) =>
              i.codigoItem === codigoItem
                ? {
                    ...i,
                    contado,
                    contadoEm: contado === null ? undefined : agoraISO(),
                  }
                : i,
            ),
          }
        : c,
    )
    gravarColecao(CONTAGENS, proximas)
    set({ contagens: proximas })
    return { ok: true }
  },

  excluirContagem: (id) => {
    const contagens = get().contagens
    const contagem = contagens.find((c) => c.id === id)
    if (!contagem) return false
    if (contagem.status !== 'Em andamento') return false
    const proximas = contagens.filter((c) => c.id !== id)
    gravarColecao(CONTAGENS, proximas)
    registrarLog({
      usuario: usuarioAtual(),
      acao: 'DELETE',
      tabela: 'CONTAGEM',
      registroId: id,
      campos: [{ campo: 'nome', antes: contagem.nome, depois: null }],
    })
    set({ contagens: proximas })
    return true
  },

  concluirContagem: (id) => {
    const contagens = get().contagens
    const contagem = contagens.find((c) => c.id === id)
    if (!contagem) return { ok: false, erro: 'Contagem não encontrada' }
    if (contagem.status !== 'Em andamento') {
      return { ok: false, erro: 'Esta contagem já foi concluída' }
    }

    const contados = contagem.itens.filter((i) => i.contado !== null)
    if (contados.length === 0) {
      return { ok: false, erro: 'Registre ao menos um item contado antes de concluir' }
    }

    const estoque = useEstoqueStore.getState()
    const usuario = usuarioAtual()
    let ajustes = 0
    let divergentes = 0
    let falhas = 0

    for (const registro of contados) {
      const item = estoque.itens.find((i) => i.codigo === registro.codigoItem)
      if (!item || registro.contado === null) continue
      if (registro.contado === item.quantidade) continue
      divergentes++
      const resultado =
        registro.contado > item.quantidade
          ? estoque.registrarEntrada({
              codigoItem: item.codigo,
              quantidade: registro.contado - item.quantidade,
              tipo: 'Ajuste',
              notas: `Ajuste de inventário ${id} (${contagem.nome})`,
            })
          : estoque.registrarSaida({
              codigoItem: item.codigo,
              quantidade: item.quantidade - registro.contado,
              tipo: 'Ajuste',
              responsavel: usuario,
              motivo: `Ajuste de inventário ${id} (${contagem.nome})`,
            })
      if (resultado.ok) ajustes++
      else falhas++
    }

    const antigo = { ...contagem }
    const atualizada: Contagem = {
      ...contagem,
      status: 'Concluída',
      concluidaEm: agoraISO(),
      ajustesGerados: ajustes,
    }
    const proximas = contagens.map((c) => (c.id === id ? atualizada : c))
    gravarColecao(CONTAGENS, proximas)
    registrarLog({
      usuario,
      acao: 'UPDATE',
      tabela: 'CONTAGEM',
      registroId: id,
      campos: [
        ...calcularDiff(
          antigo as unknown as Record<string, unknown>,
          atualizada as unknown as Record<string, unknown>,
        ),
        { campo: 'divergencias', antes: null, depois: divergentes },
      ],
      mensagem: falhas ? `${falhas} ajuste(s) não aplicado(s)` : undefined,
    })
    set({ contagens: proximas })
    return {
      ok: true,
      ajustes,
      divergentes,
      falhas,
      pendentes: contagem.itens.length - contados.length,
    }
  },
}))
