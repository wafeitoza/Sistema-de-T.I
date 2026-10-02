import { describe, expect, it } from 'vitest'
import { ordenarPor, valorOrdenavel } from './tabela'

const itens = [
  { nome: 'Web', valor: 10 },
  { nome: 'Cpu', valor: 2 },
  { nome: 'Monitor', valor: 45 },
]

describe('valorOrdenavel', () => {
  it('extrai valor primitivo ou cai para string', () => {
    expect(valorOrdenavel({ a: 5 }, 'a')).toBe(5)
    expect(valorOrdenavel({ a: 'abc' }, 'a')).toBe('abc')
    expect(valorOrdenavel({ a: undefined }, 'a')).toBe('')
    expect(valorOrdenavel({ a: null }, 'a')).toBe('')
    expect(valorOrdenavel({}, 'a')).toBe('')
  })
})

describe('ordenarPor', () => {
  it('ordena números em asc e desc', () => {
    const asc = ordenarPor(itens, { chave: 'valor', direcao: 'asc' })
    expect(asc.map((i) => i.valor)).toEqual([2, 10, 45])
    const desc = ordenarPor(itens, { chave: 'valor', direcao: 'desc' })
    expect(desc.map((i) => i.valor)).toEqual([45, 10, 2])
  })

  it('ordena strings sem diferenciar maiúsculas', () => {
    const asc = ordenarPor(itens, { chave: 'nome', direcao: 'asc' })
    expect(asc.map((i) => i.nome)).toEqual(['Cpu', 'Monitor', 'Web'])
  })

  it('ordena com acessor customizado', () => {
    const asc = ordenarPor(itens, { chave: 'valor', direcao: 'asc' }, (i) => i.valor * -1)
    expect(asc.map((i) => i.valor)).toEqual([45, 10, 2])
  })

  it('não altera o array original', () => {
    const original = [...itens]
    ordenarPor(itens, { chave: 'valor', direcao: 'desc' })
    expect(itens).toEqual(original)
  })
})
