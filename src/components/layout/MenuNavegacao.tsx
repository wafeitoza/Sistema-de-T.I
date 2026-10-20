import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { LogOut, Moon, Sun, X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { podeAcessarRota } from '../../lib/permissions'
import { ROTAS_NAVEGACAO, type SecaoNav } from '../../lib/rotas'
import { Avatar } from '../ui/Avatar'
import { useAuthStore } from '../../store/auth'
import { useUiStore } from '../../store/ui'
import type { Perfil } from '../../types'
import logo from '../../assets/logo.png'

const SECOES_NAV: SecaoNav[] = ['Operação', 'Cadastros', 'Sistema']

/**
 * Navegação do sistema num modal com fade — substitui a antiga barra lateral
 * fixa. Abre pelo botão de menu do cabeçalho (em qualquer tela) e fecha no X,
 * no fundo escuro, no ESC ou ao escolher uma rota.
 *
 * O conteúdo das seções é o mesmo de antes (seções filtradas pelo perfil);
 * só a apresentação mudou: em vez de ocupar uma coluna permanente, o menu
 * aparece e some com o mesmo fade dos outros modais do sistema.
 */
export function MenuNavegacao() {
  const usuario = useAuthStore((s) => s.usuario)
  const sair = useAuthStore((s) => s.sair)
  const tema = useUiStore((s) => s.tema)
  const alternarTema = useUiStore((s) => s.alternarTema)
  const aberto = useUiStore((s) => s.sidebarAberta)
  const alternar = useUiStore((s) => s.alternarSidebar)

  useEffect(() => {
    if (!aberto) return
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') alternar()
    }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [aberto, alternar])

  if (!usuario || !aberto) return null
  const perfil: Perfil = usuario.perfil

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Menu do sistema"
    >
      <div
        className="anim-fade-in absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={alternar}
        aria-hidden
      />
      <div className="anim-scale-in relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="group flex items-center gap-2.5">
            {/* Mesmo avatar do favicon e da tela de login, para as três
                superfícies falarem a mesma língua. O arredondamento é do CSS
                (rounded-xl + overflow-hidden) e `alt=""` porque o nome
                "IT Stock" está ao lado, em texto. */}
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl shadow-lg shadow-primary/30 transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110">
              <img
                src={logo}
                alt=""
                className="h-full w-full object-cover"
                width={36}
                height={36}
                decoding="async"
              />
            </div>
            <div>
              <p className="text-sm font-extrabold tracking-tight text-content">
                IT Stock
              </p>
              <p className="text-[11px] font-medium text-content-muted">
                Inventory &amp; Assets
              </p>
            </div>
          </div>
          <button
            onClick={alternar}
            className="rounded-lg p-1.5 text-content-muted transition-colors hover:bg-surface-2 hover:text-content"
            aria-label="Fechar menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 pb-4">
          {SECOES_NAV.map((secao) => {
            const itens = ROTAS_NAVEGACAO.filter(
              (l) => l.secao === secao && podeAcessarRota(l.para, perfil),
            )
            if (itens.length === 0) return null
            return (
              <div key={secao}>
                <p className="px-3 pb-1 pt-4 text-[10px] font-bold uppercase tracking-wider text-content-muted">
                  {secao}
                </p>
                <div className="space-y-1">
                  {itens.map((l) => (
                    <NavLink
                      key={l.para}
                      to={l.para}
                      end={l.para === '/'}
                      onClick={alternar}
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
                </div>
              </div>
            )
          })}
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
              <p className="truncate text-xs font-semibold text-content">
                {usuario.nome}
              </p>
              <p className="truncate text-[11px] text-content-muted">
                {usuario.perfil}
              </p>
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
    </div>
  )
}
