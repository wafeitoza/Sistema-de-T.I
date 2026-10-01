import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'

export function EstadoVazio({
  titulo,
  mensagem,
  acao,
}: {
  titulo: string
  mensagem: string
  acao?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line bg-surface py-14 text-center">
      <div className="anim-float flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary/15 to-info/15">
        <Inbox size={22} className="text-primary" />
      </div>
      <div>
        <p className="text-sm font-semibold text-content">{titulo}</p>
        <p className="mt-1 text-xs text-content-muted">{mensagem}</p>
      </div>
      {acao}
    </div>
  )
}
