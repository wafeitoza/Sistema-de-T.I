import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'

interface ModalProps {
  aberto: boolean
  aoFechar: () => void
  titulo: string
  children: ReactNode
  rodape?: ReactNode
  largo?: boolean
}

export function Modal({ aberto, aoFechar, titulo, children, rodape, largo }: ModalProps) {
  useEffect(() => {
    if (!aberto) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoFechar()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [aberto, aoFechar])

  if (!aberto) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={aoFechar}
      />
      <div
        className={cn(
          'relative z-10 flex max-h-[90vh] w-full flex-col rounded-xl bg-surface shadow-xl',
          largo ? 'max-w-2xl' : 'max-w-lg',
        )}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-base font-semibold text-content">{titulo}</h2>
          <button
            onClick={aoFechar}
            className="rounded-lg p-1 text-content-muted transition-colors hover:bg-surface-2 hover:text-content"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {rodape && (
          <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
            {rodape}
          </div>
        )}
      </div>
    </div>
  )
}
