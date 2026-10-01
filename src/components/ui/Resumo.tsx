import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Card3D } from './Card3D'

export function Resumo({
  titulo,
  valor,
  destaque,
  icone,
}: {
  titulo: string
  valor: string | number
  destaque?: boolean
  icone?: ReactNode
}) {
  return (
    <Card3D className="rounded-xl border border-line bg-surface p-4 shadow-card transition-shadow duration-300 hover:border-primary/30 hover:shadow-card-hover">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-content-muted">{titulo}</p>
        {icone}
      </div>
      <p
        className={cn(
          'num mt-1.5 text-2xl font-extrabold tracking-tight',
          destaque ? 'text-danger' : 'text-content',
        )}
      >
        {valor}
      </p>
    </Card3D>
  )
}
