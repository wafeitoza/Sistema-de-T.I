import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Menu, Moon, Sun } from 'lucide-react'
import { saudacao } from '../../lib/format'
import { useAuthStore } from '../../store/auth'
import { useUiStore } from '../../store/ui'
import { PrevisaoTempo } from './PrevisaoTempo'
import { Relogio } from './Relogio'

const TITULOS: Record<string, string> = {
  '/': 'Dashboard',
  '/ativos': 'Ativos',
  '/estoque': 'Estoque',
  '/inventario': 'Inventário',
  '/solicitacoes': 'Solicitações',
  '/manutencao': 'Manutenção',
}

export function Header() {
  const { pathname } = useLocation()
  const usuario = useAuthStore((s) => s.usuario)
  const tema = useUiStore((s) => s.tema)
  const alternarTema = useUiStore((s) => s.alternarTema)
  const alternarSidebar = useUiStore((s) => s.alternarSidebar)
  const [agora, setAgora] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  const primeiroNome = usuario?.nome.split(' ')[0] ?? ''

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={alternarSidebar}
          className="rounded-lg p-2 text-content-muted hover:bg-surface-2 hover:text-content md:hidden"
          aria-label="Abrir menu"
        >
          <Menu size={18} />
        </button>
        <div className="min-w-0">
          <p
            key={pathname}
            className="anim-fade-up truncate text-sm font-bold tracking-tight text-content"
          >
            {saudacao(agora)}, <span className="gradient-text">{primeiroNome}</span>
          </p>
          <p className="hidden truncate text-[11px] text-content-muted sm:block">
            {TITULOS[pathname] ?? 'IT Stock'} · Sistema de gestão de T.I.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <PrevisaoTempo />
        <Relogio />
        <button
          onClick={alternarTema}
          className="rounded-lg p-2 text-content-muted transition-all duration-200 hover:rotate-12 hover:bg-surface-2 hover:text-content hover:shadow-md active:scale-90"
          aria-label="Alternar tema"
        >
          {tema === 'claro' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      </div>
    </header>
  )
}
