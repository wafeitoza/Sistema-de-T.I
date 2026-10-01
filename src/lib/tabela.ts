import { useState } from 'react'

export function usePaginacao(totalItens: number, porPagina = 15) {
  const [pagina, setPagina] = useState(1)
  const totalPaginas = Math.max(1, Math.ceil(totalItens / porPagina))
  const paginaSegura = Math.min(Math.max(1, pagina), totalPaginas)
  const inicio = (paginaSegura - 1) * porPagina
  const fim = Math.min(inicio + porPagina, totalItens)
  return { pagina: paginaSegura, totalPaginas, inicio, fim, setPagina }
}
