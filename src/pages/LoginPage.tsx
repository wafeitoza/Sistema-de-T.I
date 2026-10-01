import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Boxes, ChevronRight, ShieldCheck } from 'lucide-react'
import { lerColecao } from '../data/repository'
import { Card3D } from '../components/ui/Card3D'
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div
        className="blob"
        style={{
          width: 440,
          height: 440,
          top: '-10rem',
          left: '-7rem',
          background: 'linear-gradient(135deg, #007aff, #5ac8fa)',
        }}
        aria-hidden
      />
      <div
        className="blob"
        style={{
          width: 380,
          height: 380,
          bottom: '-8rem',
          right: '-6rem',
          background: 'linear-gradient(135deg, #34c759, #5ac8fa)',
          animationDelay: '-7s',
        }}
        aria-hidden
      />
      <div
        className="blob"
        style={{
          width: 280,
          height: 280,
          top: '42%',
          right: '14%',
          background: 'linear-gradient(135deg, #ff9500, #ff3b30)',
          animationDelay: '-11s',
          opacity: 0.25,
        }}
        aria-hidden
      />

      <div className="relative w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="anim-fade-up anim-float flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-primary-dark to-info text-white shadow-xl shadow-primary/40">
            <Boxes size={30} />
          </div>
          <div className="anim-fade-up" style={{ animationDelay: '80ms' }}>
            <h1 className="text-2xl font-extrabold tracking-tight text-content">
              IT Stock <span className="gradient-text">&amp; Inventory</span>
            </h1>
            <p className="mt-1 text-sm text-content-muted">
              Gestão de ativos, estoque e manutenção de T.I.
            </p>
          </div>
        </div>

        <Card3D
          inclinar={5}
          className="glass anim-scale-in rounded-2xl border border-line p-5 shadow-card"
        >
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-content-muted">
            <ShieldCheck size={14} className="text-success" />
            Entrar como
          </div>
          <p className="mb-4 text-xs text-content-muted">
            Ambiente demonstrativo — selecione um perfil para continuar.
          </p>

          <div className="space-y-2">
            {usuarios.map((u, i) => (
              <button
                key={u.email}
                onClick={() => selecionar(u.email)}
                style={{ animationDelay: `${220 + i * 80}ms` }}
                className="shine anim-fade-up group flex w-full items-center gap-3 rounded-xl border border-line bg-surface/60 px-3 py-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary-light/50 hover:shadow-lg hover:shadow-primary/15 active:translate-y-0 active:scale-[0.99] dark:hover:bg-primary/10"
              >
                {u.foto ? (
                  <img
                    src={u.foto}
                    alt={u.nome}
                    className="h-10 w-10 shrink-0 rounded-xl object-cover shadow-md transition-all duration-300 group-hover:scale-110"
                  />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-surface-3 to-surface-2 text-xs font-bold text-content transition-all duration-300 group-hover:scale-110 group-hover:from-primary/25 group-hover:to-info/20 group-hover:text-primary">
                    {u.nome
                      .split(' ')
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-content">{u.nome}</p>
                  <p className="truncate text-xs text-content-muted">{u.email}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${CORES_PERFIL[u.perfil]}`}
                >
                  {u.perfil}
                </span>
                <ChevronRight
                  size={16}
                  className="text-content-muted transition-all duration-200 group-hover:translate-x-1 group-hover:text-primary"
                />
              </button>
            ))}
          </div>
        </Card3D>

        <p
          className="anim-fade-up mt-4 text-center text-[11px] text-content-muted"
          style={{ animationDelay: '600ms' }}
        >
          Dados armazenados localmente no navegador (localStorage).
        </p>
      </div>
    </div>
  )
}
