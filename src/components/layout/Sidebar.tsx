import { NavLink } from 'react-router-dom'
import {
  Boxes,
  ClipboardCheck,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Moon,
  Package,
  Sun,
  Users,
  Wrench,
  X,
} from 'lucide-react'
import { cn } from '../../lib/cn'
import { podeAcessarRota } from '../../lib/permissions'
import { Avatar } from '../ui/Avatar'
import { useAuthStore } from '../../store/auth'
import { useUiStore } from '../../store/ui'
import type { Perfil } from '../../types'

const LINKS = [
  { para: '/', rotulo: 'Dashboard', icone: LayoutDashboard },
  { para: '/ativos', rotulo: 'Ativos', icone: Boxes },
  { para: '/estoque', rotulo: 'Estoque', icone: Package },
  { para: '/inventario', rotulo: 'Inventário', icone: ClipboardCheck },
  { para: '/solicitacoes', rotulo: 'Solicitações', icone: ClipboardList },
  { para: '/manutencao', rotulo: 'Manutenção', icone: Wrench },
  { para: '/usuarios', rotulo: 'Usuários', icone: Users },
]

export function Sidebar() {
  const usuario = useAuthStore((s) => s.usuario)
  const sair = useAuthStore((s) => s.sair)
  const tema = useUiStore((s) => s.tema)
  const alternarTema = useUiStore((s) => s.alternarTema)
  const sidebarAberta = useUiStore((s) => s.sidebarAberta)
  const alternarSidebar = useUiStore((s) => s.alternarSidebar)

  if (!usuario) return null
  const perfil: Perfil = usuario.perfil

  const conteudo = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 py-5">
        <div className="group flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-primary to-info text-white shadow-lg shadow-primary/30 transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110">
            <Boxes size={18} />
          </div>
          <div>
            <p className="text-sm font-extrabold tracking-tight text-content">IT Stock</p>
            <p className="text-[11px] font-medium text-content-muted">Inventory & Assets</p>
          </div>
        </div>
        <button
          onClick={alternarSidebar}
          className="rounded-lg p-1.5 text-content-muted hover:bg-surface-2 md:hidden"
          aria-label="Fechar menu"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {LINKS.filter((l) => podeAcessarRota(l.para, perfil)).map((l) => (
          <NavLink
            key={l.para}
            to={l.para}
            end={l.para === '/'}
            onClick={alternarSidebar}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 active:scale-[0.98]',
                isActive
                  ? 'bg-gradient-to-r from-primary to-primary-dark text-white shadow-lg shadow-primary/30'
                  : 'text-content-muted hover:bg-surface-2 hover:text-content',
              )
            }
          >
            <l.icone
              size={18}
              className="transition-transform duration-200 group-hover:-rotate-6 group-hover:scale-110"
            />
            {l.rotulo}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-line p-3">
        <button
          onClick={alternarTema}
          className="mb-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-content-muted transition-all duration-200 hover:translate-x-0.5 hover:bg-surface-2 hover:text-content"
        >
          {tema === 'claro' ? <Moon size={18} /> : <Sun size={18} />}
          {tema === 'claro' ? 'Tema escuro' : 'Tema claro'}
        </button>

        <div className="flex items-center gap-3 rounded-xl border border-line bg-gradient-to-r from-surface-2 via-surface-3 to-surface-2 px-3 py-3">
          <Avatar
            nome={usuario.nome}
            foto={usuario.foto}
            className="h-9 w-9 rounded-lg text-xs shadow-md"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-content">{usuario.nome}</p>
            <p className="truncate text-[11px] text-content-muted">{usuario.perfil}</p>
          </div>
          <button
            onClick={sair}
            className="rounded-lg p-1.5 text-content-muted hover:bg-surface-3 hover:text-danger"
            aria-label="Sair"
            title="Sair"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <aside className="hidden w-64 shrink-0 border-r border-line bg-surface md:block">
        <div className="sticky top-0 h-screen">{conteudo}</div>
      </aside>

      {sidebarAberta && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={alternarSidebar}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-line bg-surface shadow-xl">
            {conteudo}
          </aside>
        </div>
      )}
    </>
  )
}
