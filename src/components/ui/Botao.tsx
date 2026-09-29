import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

type Variante = 'primario' | 'secundario' | 'perigo' | 'fantasma'
type Tamanho = 'sm' | 'md'

interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante
  tamanho?: Tamanho
  children: ReactNode
}

const VARIANTES: Record<Variante, string> = {
  primario:
    'bg-primary text-white hover:bg-primary-dark focus-visible:ring-primary',
  secundario:
    'bg-surface-2 text-content border border-line hover:bg-surface-3 focus-visible:ring-primary',
  perigo:
    'bg-danger text-white hover:brightness-90 focus-visible:ring-danger',
  fantasma:
    'text-content-muted hover:bg-surface-2 hover:text-content focus-visible:ring-primary',
}

const TAMANHOS: Record<Tamanho, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
}

export function Botao({
  variante = 'primario',
  tamanho = 'md',
  className,
  children,
  ...resto
}: BotaoProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-2',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANTES[variante],
        TAMANHOS[tamanho],
        className,
      )}
      {...resto}
    >
      {children}
    </button>
  )
}
