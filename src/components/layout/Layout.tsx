import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { podeAcessarRota } from '../../lib/permissions'
import { useAuthStore } from '../../store/auth'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

export function Layout() {
  const usuario = useAuthStore((s) => s.usuario)
  const { pathname } = useLocation()

  if (!usuario) return <Navigate to="/login" replace />

  const permitido = podeAcessarRota(pathname, usuario.perfil)

  return (
    <div className="flex min-h-screen bg-surface-2">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 p-4 md:p-6">
          <div key={pathname} className="anim-pagina">
            {permitido ? (
              <OutletContent />
            ) : (
              <AcessoNegado perfil={usuario.perfil} />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

function OutletContent() {
  return <Outlet />
}

function AcessoNegado({ perfil }: { perfil: string }) {
  return (
    <div className="anim-bounce-in mx-auto mt-16 flex max-w-md flex-col items-center gap-3 rounded-2xl border border-line bg-surface p-8 text-center shadow-card">
      <div className="anim-pulse-ring flex h-12 w-12 items-center justify-center rounded-full bg-danger/15">
        <ShieldAlert size={22} className="text-danger" />
      </div>
      <h2 className="text-base font-semibold text-content">Acesso restrito</h2>
      <p className="text-sm text-content-muted">
        O perfil <strong>{perfil}</strong> não tem permissão para acessar este módulo.
      </p>
    </div>
  )
}
