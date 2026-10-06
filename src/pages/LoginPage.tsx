import {
  useEffect,
  useState,
  type CSSProperties,
  type FormEvent,
  type MouseEvent,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { Boxes, ChevronRight, Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react'
import { modoSupabase } from '../data/client'
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

const SEM_PARALLAX =
  typeof window !== 'undefined' &&
  !window.matchMedia('(prefers-reduced-motion: no-preference)').matches

function aoMover(e: MouseEvent<HTMLDivElement>) {
  if (SEM_PARALLAX) return
  const x = e.clientX / window.innerWidth - 0.5
  const y = e.clientY / window.innerHeight - 0.5
  e.currentTarget.style.setProperty('--px', `${(-x * 16).toFixed(1)}px`)
  e.currentTarget.style.setProperty('--py', `${(-y * 12).toFixed(1)}px`)
}

export function LoginPage() {
  const entrar = useAuthStore((s) => s.entrar)
  const entrarComSenha = useAuthStore((s) => s.entrarComSenha)
  const usuario = useAuthStore((s) => s.usuario)
  const navigate = useNavigate()
  const usuarios = lerColecao<Usuario>('USUARIOS').filter((u) => u.status === 'Ativo')

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [mostrarSenha, setMostrarSenha] = useState(false)

  useEffect(() => {
    if (usuario) navigate('/', { replace: true })
  }, [usuario, navigate])

  function selecionar(emailEscolhido: string) {
    if (entrar(emailEscolhido)) navigate('/', { replace: true })
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setEnviando(true)
    const r = await entrarComSenha(email, senha)
    setEnviando(false)
    if (!r.ok) {
      setErro(r.erro ?? 'Não foi possível entrar agora')
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden p-4"
      onMouseMove={aoMover}
      style={{ '--px': '0px', '--py': '0px' } as CSSProperties}
    >
      <div className="fundo-camada anim-fade-in" aria-hidden>
        <div className="aurora-login" />
        <div className="grade-login" />
        <div
          className="blob"
          style={{
            width: 440,
            height: 440,
            top: '-10rem',
            left: '-7rem',
            background: 'linear-gradient(135deg, #007aff, #5ac8fa)',
          }}
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
        />
        <div className="feixe-login" />
      </div>

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
          {modoSupabase ? (
            <form onSubmit={enviar} noValidate>
              <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-content-muted">
                <Lock size={14} className="text-success" />
                Entrar
              </div>
              <p className="mb-4 text-xs text-content-muted">
                Acesso restrito aos usuários cadastrados no sistema.
              </p>

              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-content-muted">
                    E-mail
                  </span>
                  <input
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@empresa.com"
                    className="w-full rounded-lg border border-line bg-surface/70 px-3 py-2.5 text-sm text-content placeholder:text-content-muted transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-content-muted">
                    Senha
                  </span>
                  <div className="relative">
                    <input
                      type={mostrarSenha ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-lg border border-line bg-surface/70 px-3 py-2.5 pr-10 text-sm text-content placeholder:text-content-muted transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarSenha((v) => !v)}
                      title={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-content-muted hover:text-content"
                    >
                      {mostrarSenha ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </label>

                {erro && (
                  <p
                    role="alert"
                    className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs font-medium text-danger"
                  >
                    {erro}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={enviando}
                  className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-primary-dark hover:shadow-lg hover:shadow-primary/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {enviando ? 'Entrando…' : 'Entrar'}
                </button>
              </div>
            </form>
          ) : (
            <>
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
                      className="text-content-muted transition-all duration-300 group-hover:translate-x-1 group-hover:text-primary"
                    />
                  </button>
                ))}
              </div>
            </>
          )}
        </Card3D>

        <p
          className="anim-fade-up mt-4 text-center text-[11px] text-content-muted"
          style={{ animationDelay: '600ms' }}
        >
          {modoSupabase
            ? 'Entre com o e-mail e a senha fornecidos pelo administrador.'
            : 'Dados armazenados localmente no navegador (localStorage).'}
        </p>
      </div>
    </div>
  )
}
