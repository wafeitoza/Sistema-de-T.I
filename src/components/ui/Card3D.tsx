import { useRef, type PointerEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

const semMovimento =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

interface Card3DProps {
  children: ReactNode
  className?: string
  inclinar?: number
  brilho?: boolean
}

export function Card3D({ children, className, inclinar = 8, brilho = true }: Card3DProps) {
  const ref = useRef<HTMLDivElement>(null)

  function mover(e: PointerEvent<HTMLDivElement>) {
    if (semMovimento) return
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    el.style.setProperty('--ry', `${((px - 0.5) * inclinar * 2).toFixed(2)}deg`)
    el.style.setProperty('--rx', `${((0.5 - py) * inclinar * 2).toFixed(2)}deg`)
    el.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`)
    el.style.setProperty('--my', `${(py * 100).toFixed(1)}%`)
  }

  function sair() {
    const el = ref.current
    if (!el) return
    el.style.setProperty('--rx', '0deg')
    el.style.setProperty('--ry', '0deg')
  }

  return (
    <div className="[perspective:1000px]">
      <div
        ref={ref}
        onPointerMove={mover}
        onPointerLeave={sair}
        className={cn('card-3d group relative h-full', className)}
      >
        {children}
        {brilho && <span className="card-glare" aria-hidden />}
      </div>
    </div>
  )
}
