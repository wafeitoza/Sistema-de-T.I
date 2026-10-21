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
    'bg-action text-action-text hover:bg-action-hover hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/25 focus-visible:ring-primary active:translate-y-0 active:scale-95',
  secundario:
    'bg-surface-2 text-content border border-line hover:bg-surface-3 hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-primary active:translate-y-0 active:scale-95',
  perigo:
    'bg-danger text-white hover:brightness-90 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-danger/30 focus-visible:ring-danger active:translate-y-0 active:scale-95',
  fantasma:
    'text-content-muted hover:bg-surface-2 hover:text-content focus-visible:ring-primary active:scale-95',
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
        'inline-flex items-center justify-center rounded-full font-medium transition-all duration-200',
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
