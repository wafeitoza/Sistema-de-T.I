import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { useUiStore, type TipoToast } from '../../store/ui'

const ICONES: Record<TipoToast, ReactNode> = {
  sucesso: <CheckCircle2 size={18} className="text-success" />,
  erro: <AlertTriangle size={18} className="text-danger" />,
  info: <Info size={18} className="text-info" />,
}

const BORDAS: Record<TipoToast, string> = {
  sucesso: 'border-l-success',
  erro: 'border-l-danger',
  info: 'border-l-info',
}

export function Toasts() {
  const toasts = useUiStore((s) => s.toasts)
  const remover = useUiStore((s) => s.removerToast)

  if (toasts.length === 0) return null

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cnToast(BORDAS[t.tipo])}
          role="status"
        >
          {ICONES[t.tipo]}
          <p className="flex-1 text-xs text-content">{t.mensagem}</p>
          <button
            onClick={() => remover(t.id)}
            className="text-content-muted hover:text-content"
            aria-label="Fechar aviso"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}

function cnToast(borda: string): string {
  return `pointer-events-auto flex items-start gap-2 rounded-lg border border-line border-l-4 bg-surface px-3 py-2.5 shadow-lg ${borda}`
}
