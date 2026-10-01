import { useCallback, useState } from 'react'

export function usePaginacao(totalItens: number, porPagina = 15) {
  const [pagina, setPagina] = useState(1)
  const totalPaginas = Math.max(1, Math.ceil(totalItens / porPagina))
  const paginaSegura = Math.min(Math.max(1, pagina), totalPaginas)
  const inicio = (paginaSegura - 1) * porPagina
  const fim = Math.min(inicio + porPagina, totalItens)
  return { pagina: paginaSegura, totalPaginas, inicio, fim, setPagina }
}

export type Direcao = 'asc' | 'desc'

export interface Ordenacao {
  chave: string
  direcao: Direcao
}

export function valorOrdenavel(
  item: unknown,
  chave: string,
): string | number {
  const v = (item as Record<string, unknown>)[chave]
  if (v === null || v === undefined) return ''
  if (typeof v === 'number') return v
  return String(v).toLowerCase()
}

export function ordenarPor<T>(
  itens: T[],
  ord: Ordenacao,
  acessor?: (item: T, chave: string) => string | number | undefined,
): T[] {
  const get = (item: T, chave: string): string | number => {
    const v = acessor ? acessor(item, chave) : undefined
    return v === undefined ? valorOrdenavel(item, chave) : v
  }
  return [...itens].sort((a, b) => {
    const va = get(a, ord.chave)
    const vb = get(b, ord.chave)
    let cmp: number
    if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb
    else cmp = String(va).localeCompare(String(vb), 'pt-BR')
    return ord.direcao === 'asc' ? cmp : -cmp
  })
}

export function useOrdenacao(chaveInicial: string, direcaoInicial: Direcao = 'asc') {
  const [ord, setOrd] = useState<Ordenacao>({ chave: chaveInicial, direcao: direcaoInicial })
  const ordenar = useCallback((chave: string) => {
    setOrd((anterior) =>
      anterior.chave === chave
        ? { chave, direcao: anterior.direcao === 'asc' ? 'desc' : 'asc' }
        : { chave, direcao: 'asc' },
    )
  }, [])
  return { ord, ordenar }
}
