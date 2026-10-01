import type { ReactNode } from 'react'
import { ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '../../lib/cn'
import type { Ordenacao } from '../../lib/tabela'

export function Tabela({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className={cn('tabela-animada w-full text-left text-sm', className)}>{children}</table>
    </div>
  )
}

interface CabecalhoProps {
  colunas: string[]
  chaves?: (string | null)[]
  ord?: Ordenacao | null
  aoOrdenar?: (chave: string) => void
}

export function CabecalhoTabela({ colunas, chaves, ord, aoOrdenar }: CabecalhoProps) {
  return (
    <thead>
      <tr className="border-b border-line bg-surface-2">
        {colunas.map((c, i) => {
          const chave = chaves ? chaves[i] : null
          const ativa = !!ord && chave !== null && chave !== undefined && ord.chave === chave
          return (
            <th
              key={c}
              className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-content-muted"
            >
              {aoOrdenar && chave ? (
                <button
                  type="button"
                  onClick={() => aoOrdenar(chave)}
                  className={cn(
                    'inline-flex items-center gap-1 transition-colors hover:text-content',
                    ativa && 'text-primary',
                  )}
                >
                  {c}
                  {ativa ? (
                    ord?.direcao === 'asc' ? (
                      <ChevronUp size={12} />
                    ) : (
                      <ChevronDown size={12} />
                    )
                  ) : (
                    <ArrowUpDown size={12} className="opacity-40" />
                  )}
                </button>
              ) : (
                c
              )}
            </th>
          )
        })}
      </tr>
    </thead>
  )
}

export function Celula({
  children,
  className,
  colSpan,
}: {
  children: ReactNode
  className?: string
  colSpan?: number
}) {
  return (
    <td className={cn('px-4 py-3 align-middle text-content', className)} colSpan={colSpan}>
      {children}
    </td>
  )
}

export function Linha({ children }: { children: ReactNode }) {
  return (
    <tr className="border-b border-line last:border-b-0 hover:bg-surface-2/60">
      {children}
    </tr>
  )
}
