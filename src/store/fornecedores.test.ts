import { beforeEach, describe, expect, it } from 'vitest'
import { lerColecao } from '../data/repository'
import type { Fornecedor, ItemEstoque, LogEntrada } from '../types'
import { useFornecedoresStore } from './fornecedores'

const FORNECEDOR: Fornecedor = {
  id: 'FOR-2026-000001',
  nome: 'Dell Brasil',
  cnpj: '11.222.333/0001-44',
  ativo: true,
}

function itemEstoque(fornecedor?: string): ItemEstoque {
  return {
    codigo: 'Item-001',
    descricao: 'SSD 480GB',
    categoria: 'Armazenamento',
    quantidade: 9,
    quantidadeMinima: 5,
    unidade: 'Peça',
    fornecedor,
  }
}

describe('useFornecedoresStore.excluir', () => {
  beforeEach(() => {
    localStorage.clear()
    useFornecedoresStore.setState({ fornecedores: [{ ...FORNECEDOR }] })
  })

  it('remove o fornecedor e registra DELETE na auditoria', () => {
    const resultado = useFornecedoresStore.getState().excluir(FORNECEDOR.id)

    expect(resultado).toEqual({ ok: true })
    expect(useFornecedoresStore.getState().fornecedores).toEqual([])

    const logs = lerColecao<LogEntrada>('LOG')
    expect(logs).toHaveLength(1)
    expect(logs[0].acao).toBe('DELETE')
    expect(logs[0].tabela).toBe('FORNECEDORES')
    expect(logs[0].registroId).toBe(FORNECEDOR.id)
    expect(logs[0].campos.find((c) => c.campo === 'nome')?.antes).toBe('Dell Brasil')
    expect(logs[0].campos.find((c) => c.campo === 'nome')?.depois).toBeNull()
  })

  it('bloqueia a exclusão quando há item de estoque usando o fornecedor', () => {
    localStorage.setItem(
      'ITSTOCK_ESTOQUE',
      JSON.stringify([itemEstoque('Dell Brasil')]),
    )

    const resultado = useFornecedoresStore.getState().excluir(FORNECEDOR.id)

    expect(resultado.ok).toBe(false)
    expect(resultado.erro).toContain('item(ns) de estoque')
    expect(useFornecedoresStore.getState().fornecedores).toHaveLength(1)
    expect(lerColecao<LogEntrada>('LOG')).toHaveLength(0)
  })

  it('ignora a caixa/nascentes do nome ao comparar o vínculo com o estoque', () => {
    localStorage.setItem(
      'ITSTOCK_ESTOQUE',
      JSON.stringify([itemEstoque('  dell brasil ')]),
    )

    const resultado = useFornecedoresStore.getState().excluir(FORNECEDOR.id)

    expect(resultado.ok).toBe(false)
    expect(useFornecedoresStore.getState().fornecedores).toHaveLength(1)
  })

  it('devolve erro para id inexistente', () => {
    const resultado = useFornecedoresStore.getState().excluir('FOR-2026-999999')

    expect(resultado).toEqual({ ok: false, erro: 'Fornecedor não encontrado.' })
    expect(useFornecedoresStore.getState().fornecedores).toHaveLength(1)
  })
})
