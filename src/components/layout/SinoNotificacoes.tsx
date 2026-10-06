import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Bell, Check, CheckCheck, Inbox } from 'lucide-react'
import { cn } from '../../lib/cn'
import {
  type Alerta,
  calcularAlertas,
  lerLidas,
  marcarLida,
  marcarTodasLidas,
} from '../../lib/notificacoes'
import { useAuthStore } from '../../store/auth'
import { useEstoqueStore } from '../../store/estoque'
import { useInventarioStore } from '../../store/inventario'
import { useManutencoesStore } from '../../store/manutencao'
import { useSolicitacoesStore } from '../../store/solicitacoes'
import { useEmprestimosStore } from '../../store/emprestimos'

const ICONE_TOM = {
  danger: <AlertTriangle size={15} className="text-danger" />,
  warning: <AlertTriangle size={15} className="text-warning" />,
  info: <Check size={15} className="text-info" />,
} as const

export function SinoNotificacoes() {
  const usuario = useAuthStore((s) => s.usuario)
  const navigate = useNavigate()
  const [aberto, setAberto] = useState(false)
  const [lidas, setLidas] = useState<Record<string, string>>(lerLidas)
  const ref = useRef<HTMLDivElement>(null)

  const itens = useEstoqueStore((s) => s.itens)
  const manutencoes = useManutencoesStore((s) => s.manutencoes)
  const solicitacoes = useSolicitacoesStore((s) => s.solicitacoes)
  const contagens = useInventarioStore((s) => s.contagens)
  const emprestimos = useEmprestimosStore((s) => s.emprestimos)

  const alertas = useMemo(
    () =>
      calcularAlertas(usuario?.perfil, {
        estoque: itens,
        manutencoes,
        solicitacoes,
        contagens,
        emprestimos,
      }),
    [usuario?.perfil, itens, manutencoes, solicitacoes, contagens, emprestimos],
  )

  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setAberto(false)
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAberto(false)
    }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', esc)
    }
  }, [aberto])

  const naoLidas = alertas.filter((a) => !lidas[a.id])

  function abrirAlerta(a: Alerta) {
    marcarLida(a.id)
    setLidas(lerLidas())
    setAberto(false)
    navigate(a.rota)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setAberto((v) => !v)}
        className="relative rounded-lg p-2 text-content-muted transition-all duration-200 hover:bg-surface-2 hover:text-content"
        aria-label={
          naoLidas.length
            ? `Notificações — ${naoLidas.length} não lidas`
            : 'Notificações'
        }
        aria-expanded={aberto}
      >
        <Bell size={18} />
        {naoLidas.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white">
            {naoLidas.length > 9 ? '9+' : naoLidas.length}
          </span>
        )}
      </button>

      {aberto && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-line bg-surface shadow-2xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-semibold text-content">Notificações</p>
            {naoLidas.length > 0 && (
              <button
                onClick={() => {
                  marcarTodasLidas(alertas.map((a) => a.id))
                  setLidas(lerLidas())
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <CheckCheck size={13} /> Marcar todas
              </button>
            )}
          </div>

          {alertas.length ? (
            <ul className="max-h-80 divide-y divide-line overflow-y-auto">
              {alertas.map((a) => {
                const lida = !!lidas[a.id]
                return (
                  <li key={a.id}>
                    <button
                      onClick={() => abrirAlerta(a)}
                      className={cn(
                        'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2',
                        lida && 'opacity-60',
                      )}
                    >
                      <span className="mt-0.5 shrink-0">{ICONE_TOM[a.tom]}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-xs font-semibold text-content">
                            {a.titulo}
                          </span>
                          {!lida && (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                          )}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-content-muted">
                          {a.descricao}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <Inbox size={22} className="text-content-muted" />
              <p className="text-sm font-medium text-content">Tudo em dia</p>
              <p className="text-xs text-content-muted">
                Nenhuma alerta pendente no momento.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
