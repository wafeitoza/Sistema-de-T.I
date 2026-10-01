import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Botao } from './Botao'

export function Paginacao({
  pagina,
  totalPaginas,
  totalItens,
  exibindoDe,
  exibindoAte,
  aoMudar,
}: {
  pagina: number
  totalPaginas: number
  totalItens: number
  exibindoDe: number
  exibindoAte: number
  aoMudar: (pagina: number) => void
}) {
  if (totalPaginas <= 1) {
    return (
      <p className="text-right text-xs text-content-muted">
        {totalItens} registro(s)
      </p>
    )
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-content-muted">
        Exibindo {exibindoDe}–{exibindoAte} de {totalItens}
      </p>
      <div className="flex items-center gap-1.5">
        <Botao
          variante="secundario"
          tamanho="sm"
          disabled={pagina <= 1}
          onClick={() => aoMudar(pagina - 1)}
        >
          <ChevronLeft size={14} /> Anterior
        </Botao>
        <span className="px-1 text-xs text-content-muted">
          Página {pagina} de {totalPaginas}
        </span>
        <Botao
          variante="secundario"
          tamanho="sm"
          disabled={pagina >= totalPaginas}
          onClick={() => aoMudar(pagina + 1)}
        >
          Próxima <ChevronRight size={14} />
        </Botao>
      </div>
    </div>
  )
}
