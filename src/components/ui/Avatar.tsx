import { cn } from '../../lib/cn'

function iniciaisDe(nome: string): string {
  return nome
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function Avatar({
  nome,
  foto,
  className,
}: {
  nome: string
  foto?: string
  className?: string
}) {
  if (foto) {
    return <img src={foto} alt={nome} className={cn('shrink-0 object-cover', className)} />
  }
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center bg-gradient-to-br from-primary to-info font-bold text-white',
        className,
      )}
    >
      {iniciaisDe(nome)}
    </span>
  )
}
