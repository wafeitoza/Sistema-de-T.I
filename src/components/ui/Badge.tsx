import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { TONS, tomDoStatus, type Tom } from './tom'

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
