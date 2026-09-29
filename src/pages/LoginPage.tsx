import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Boxes, ChevronRight } from 'lucide-react'
import { lerColecao } from '../data/repository'
import { useAuthStore } from '../store/auth'
import type { Usuario } from '../types'

const CORES_PERFIL: Record<string, string> = {
  Admin: 'bg-danger/15 text-danger',
  Gerente: 'bg-warning/15 text-warning',
  Técnico: 'bg-primary/15 text-primary',
  Visualizador: 'bg-info/15 text-info',
}

export function LoginPage() {
  const entrar = useAuthStore((s) => s.entrar)
  const usuario = useAuthStore((s) => s.usuario)
  const navigate = useNavigate()
  const usuarios = lerColecao<Usuario>('USUARIOS').filter((u) => u.status === 'Ativo')

  useEffect(() => {
    if (usuario) navigate('/', { replace: true })
  }, [usuario, navigate])

  function selecionar(email: string) {
    if (entrar(email)) navigate('/', { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-2 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-lg">
            <Boxes size={26} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-content">IT Stock &amp; Inventory</h1>
            <p className="mt-1 text-sm text-content-muted">
              Gestão de ativos, estoque e manutenção de T.I.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-5 shadow-sm">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-content-muted">
            Entrar como
          </p>
          <p className="mb-4 text-xs text-content-muted">
            Ambiente demonstrativo — selecione um perfil para continuar.
          </p>

          <div className="space-y-2">
            {usuarios.map((u) => (
              <button
                key={u.email}
                onClick={() => selecionar(u.email)}
                className="group flex w-full items-center gap-3 rounded-lg border border-line px-3 py-3 text-left transition-colors hover:border-primary hover:bg-primary-light/50 dark:hover:bg-primary/10"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-3 text-xs font-semibold text-content">
                  {u.nome
                    .split(' ')
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-content">{u.nome}</p>
                  <p className="truncate text-xs text-content-muted">{u.email}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CORES_PERFIL[u.perfil]}`}
                >
                  {u.perfil}
                </span>
                <ChevronRight
                  size={16}
                  className="text-content-muted transition-transform group-hover:translate-x-0.5"
                />
              </button>
            ))}
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] text-content-muted">
          Dados armazenados localmente no navegador (localStorage).
        </p>
      </div>
    </div>
  )
}
