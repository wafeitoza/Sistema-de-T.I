import { useLocation } from 'react-router-dom'
import { Menu, Moon, Sun } from 'lucide-react'
import { useUiStore } from '../../store/ui'

const TITULOS: Record<string, string> = {
  '/': 'Dashboard',
  '/ativos': 'Ativos',
  '/estoque': 'Estoque',
  '/solicitacoes': 'Solicitações',
  '/manutencao': 'Manutenção',
}

export function Header() {
  const { pathname } = useLocation()
  const tema = useUiStore((s) => s.tema)
  const alternarTema = useUiStore((s) => s.alternarTema)
  const alternarSidebar = useUiStore((s) => s.alternarSidebar)

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface/90 px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={alternarSidebar}
          className="rounded-lg p-2 text-content-muted hover:bg-surface-2 hover:text-content md:hidden"
          aria-label="Abrir menu"
        >
          <Menu size={18} />
        </button>
        <div>
          <h1 className="text-sm font-semibold text-content">
            {TITULOS[pathname] ?? 'IT Stock'}
          </h1>
          <p className="hidden text-[11px] text-content-muted sm:block">
            Sistema de gestão de T.I.
          </p>
        </div>
      </div>

      <button
        onClick={alternarTema}
        className="rounded-lg p-2 text-content-muted transition-colors hover:bg-surface-2 hover:text-content"
        aria-label="Alternar tema"
      >
        {tema === 'claro' ? <Moon size={18} /> : <Sun size={18} />}
      </button>
    </header>
  )
}
