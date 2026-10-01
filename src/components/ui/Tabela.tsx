import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export function Tabela({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className={cn('tabela-animada w-full text-left text-sm', className)}>{children}</table>
    </div>
  )
}

export function CabecalhoTabela({ colunas }: { colunas: string[] }) {
  return (
    <thead>
      <tr className="border-b border-line bg-surface-2">
        {colunas.map((c) => (
          <th
            key={c}
            className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-content-muted"
          >
            {c}
          </th>
        ))}
      </tr>
    </thead>
  )
}

export function Celula({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <td className={cn('px-4 py-3 align-middle text-content', className)}>{children}</td>
  )
}

export function Linha({ children }: { children: ReactNode }) {
  return (
    <tr className="border-b border-line last:border-b-0 hover:bg-surface-2/60">
      {children}
    </tr>
  )
}
