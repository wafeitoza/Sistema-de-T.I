import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export function Card({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-line bg-surface p-5 shadow-sm',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function TituloSecao({
  children,
  acao,
}: {
  children: ReactNode
  acao?: ReactNode
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h1 className="text-xl font-semibold text-content">{children}</h1>
      {acao}
    </div>
  )
}
