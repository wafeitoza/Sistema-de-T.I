import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

type Tom = 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'neutral'

const TONS: Record<Tom, string> = {
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
  info: 'bg-info/15 text-info',
  primary: 'bg-primary/15 text-primary',
  neutral: 'bg-surface-3 text-content-muted',
}

const MAPA_STATUS: Record<string, Tom> = {
  Ativo: 'success',
  Inativo: 'neutral',
  Manutenção: 'warning',
  Descartado: 'danger',
  Normal: 'success',
  Baixo: 'warning',
  Zerado: 'danger',
  Rascunho: 'neutral',
  Enviada: 'info',
  Aprovada: 'success',
  Rejeitada: 'danger',
  Finalizada: 'primary',
  Agendada: 'info',
  'Em Execução': 'warning',
  Concluída: 'success',
  Cancelada: 'neutral',
  Pendente: 'warning',
}

export function tomDoStatus(status: string): Tom {
  return MAPA_STATUS[status] ?? 'neutral'
}

export function Badge({
  children,
  tom = 'neutral',
  className,
}: {
  children: ReactNode
  tom?: Tom
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        TONS[tom],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function BadgeStatus({ status }: { status: string }) {
  return <Badge tom={tomDoStatus(status)}>{status}</Badge>
}
