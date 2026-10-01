import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'

function dois(n: number): string {
  return String(n).padStart(2, '0')
}

function primeiraMaiuscula(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function Ponteiro({
  angulo,
  comprimento,
  cor,
  largura,
  cauda = 0,
}: {
  angulo: number
  comprimento: number
  cor: string
  largura: number
  cauda?: number
}) {
  return (
    <line
      x1="50"
      y1={50 + cauda}
      x2="50"
      y2={50 - comprimento}
      stroke={cor}
      strokeWidth={largura}
      strokeLinecap="round"
      style={{
        transformOrigin: '50px 50px',
        transform: `rotate(${angulo}deg)`,
        transition: 'transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    />
  )
}

export function Relogio() {
  const [agora, setAgora] = useState(() => new Date())
  const [aberto, setAberto] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = window.setInterval(() => setAgora(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    if (!aberto) return
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAberto(false)
    }
    const aoClicar = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('keydown', aoTeclar)
    document.addEventListener('mousedown', aoClicar)
    return () => {
      document.removeEventListener('keydown', aoTeclar)
      document.removeEventListener('mousedown', aoClicar)
    }
  }, [aberto])

  const h = agora.getHours()
  const m = agora.getMinutes()
  const s = agora.getSeconds()

  const dataCurta = primeiraMaiuscula(
    agora.toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    }),
  )
  const dataLonga = primeiraMaiuscula(
    agora.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }),
  )
  const fuso = Intl.DateTimeFormat().resolvedOptions().timeZone

  const anguloSegundo = s * 6
  const anguloMinuto = (m + s / 60) * 6
  const anguloHora = ((h % 12) + m / 60) * 30

  return (
    <div ref={raiz} className="relative">
      <button
        onClick={() => setAberto((v) => !v)}
        aria-label="Mostrar relógio detalhado"
        aria-expanded={aberto}
        className={cn(
          'shine flex items-center gap-2.5 rounded-xl border bg-surface/70 px-3 py-1.5 backdrop-blur transition-all duration-200',
          aberto
            ? 'border-primary/50 shadow-lg shadow-primary/20'
            : 'border-line hover:border-primary/40 hover:shadow-md',
        )}
      >
        <div className="flex flex-col items-end leading-none">
          <span className="num text-sm font-extrabold tracking-tight text-content">
            {dois(h)}
            <span className="mx-px animate-pulse text-primary">:</span>
            {dois(m)}
          </span>
          <span className="mt-1 hidden text-[10px] font-medium text-content-muted sm:block">
            {dataCurta}
          </span>
        </div>
        <span className="num rounded-md bg-primary/10 px-1.5 py-1 text-[11px] font-bold text-primary transition-colors group-hover:bg-primary/15">
          {dois(s)}
        </span>
      </button>

      {aberto && (
        <div className="anim-scale-in absolute right-0 top-full z-50 mt-2 w-72 origin-top-right">
          <div className="glass rounded-2xl border border-line p-4 shadow-card-hover">
            <div className="flex items-center gap-4">
              <svg
                viewBox="0 0 100 100"
                className="h-24 w-24 shrink-0"
                aria-label="Relógio analógico"
              >
                <circle
                  cx="50"
                  cy="50"
                  r="47"
                  className="fill-surface-3 stroke-line"
                  strokeWidth="2"
                />
                {Array.from({ length: 12 }, (_, i) => {
                  const a = i * 30
                  const forte = i % 3 === 0
                  return (
                    <line
                      key={i}
                      x1="50"
                      y1={forte ? 8 : 7}
                      x2="50"
                      y2={forte ? 15 : 12}
                      className={forte ? 'stroke-content' : 'stroke-content-muted'}
                      strokeWidth={forte ? 2.4 : 1.4}
                      strokeLinecap="round"
                      transform={`rotate(${a} 50 50)`}
                      opacity={forte ? 0.85 : 0.5}
                    />
                  )
                })}
                <Ponteiro angulo={anguloHora} comprimento={22} cor="var(--content)" largura={4} />
                <Ponteiro angulo={anguloMinuto} comprimento={32} cor="var(--content-muted)" largura={3} />
                <Ponteiro
                  angulo={anguloSegundo}
                  comprimento={36}
                  cor="#007aff"
                  largura={1.8}
                  cauda={7}
                />
                <circle cx="50" cy="50" r="3.5" fill="#007aff" />
                <circle cx="50" cy="50" r="1.4" className="fill-surface" />
              </svg>

              <div className="min-w-0">
                <p className="num text-2xl font-extrabold tracking-tight text-content">
                  {dois(h)}
                  <span className="animate-pulse text-primary">:</span>
                  {dois(m)}
                  <span className="num ml-1 text-sm font-bold text-primary">{dois(s)}</span>
                </p>
                <p className="mt-1 text-xs font-medium text-content">
                  {dataLonga}
                </p>
                <p className="mt-1.5 flex items-center gap-1.5 text-[10px] text-content-muted">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
                  {fuso}
                </p>
              </div>
            </div>
            <p className="mt-3 border-t border-line pt-2.5 text-center text-[10px] text-content-muted">
              Clique fora ou pressione Esc para fechar
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
