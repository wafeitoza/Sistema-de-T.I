import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export function Reveal({
  children,
  atraso = 0,
  className,
}: {
  children: ReactNode
  atraso?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visivel, setVisivel] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Rede de segurança: nunca deixa conteúdo invisível se o observer falhar.
    const seguranca = window.setTimeout(() => setVisivel(true), 2000)
    const io = new IntersectionObserver(
      (entradas) => {
        if (entradas[0]?.isIntersecting) {
          setVisivel(true)
          io.disconnect()
        }
      },
      { threshold: 0.12 },
    )
    io.observe(el)
    return () => {
      window.clearTimeout(seguranca)
      io.disconnect()
    }
  }, [])

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${atraso}ms` }}
      className={cn(
        'transition-all duration-700 ease-out',
        visivel ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
        className,
      )}
    >
      {children}
    </div>
  )
}
