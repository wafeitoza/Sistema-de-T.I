import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { cn } from '../../lib/cn'
import { formatarNumeroBR, parseMoeda } from '../../lib/format'

const BASE =
  'w-full rounded-lg border border-line bg-surface px-3 text-sm text-content placeholder:text-content-muted transition-all duration-200 hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50'

const BASE_ERRO = 'border-danger focus:border-danger focus:ring-danger/30'

interface CampoBase {
  label: string
  erro?: string
  className?: string
}

export function Campo({
  label,
  erro,
  className,
  children,
}: CampoBase & { children: ReactNode }) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-xs font-medium text-content-muted">
        {label}
      </span>
      {children}
      {erro && <span className="mt-1 block text-xs text-danger">{erro}</span>}
    </label>
  )
}

export function Entrada({
  label,
  erro,
  className,
  ...resto
}: CampoBase & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Campo label={label} erro={erro} className={className}>
      <input className={cn(BASE, erro && BASE_ERRO)} {...resto} />
    </Campo>
  )
}

type OpcoesMoeda = CampoBase & {
  valor: string
  aoMudar: (texto: string) => void
  placeholder?: string
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'onBlur' | 'type'>

export function CampoMoeda({
  label,
  erro,
  className,
  valor,
  aoMudar,
  placeholder = '0,00',
  ...resto
}: OpcoesMoeda) {
  return (
    <Campo label={label} erro={erro} className={className}>
      <div className="relative">
        <input
          className={cn(BASE, 'pr-10', erro && BASE_ERRO)}
          inputMode="decimal"
          autoComplete="off"
          value={valor}
          placeholder={placeholder}
          onChange={(e) => aoMudar(e.target.value.replace(/[^\d.,]/g, ''))}
          onBlur={() => {
            const n = parseMoeda(valor)
            aoMudar(n === undefined ? '' : formatarNumeroBR(n))
          }}
          {...resto}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-semibold text-content-muted">
          R$
        </span>
      </div>
    </Campo>
  )
}

export function AreaTexto({
  label,
  erro,
  className,
  ...resto
}: CampoBase & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Campo label={label} erro={erro} className={className}>
      <textarea className={cn(BASE, 'min-h-24 py-2', erro && BASE_ERRO)} {...resto} />
    </Campo>
  )
}

export interface Opcao {
  valor: string
  rotulo: string
}

export function Selecao({
  label,
  erro,
  className,
  opcoes,
  placeholder,
  ...resto
}: CampoBase &
  SelectHTMLAttributes<HTMLSelectElement> & {
    opcoes: Opcao[]
    placeholder?: string
  }) {
  return (
    <Campo label={label} erro={erro} className={className}>
      <select className={cn(BASE, 'appearance-none', erro && BASE_ERRO)} {...resto}>
        {placeholder && <option value="">{placeholder}</option>}
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </Campo>
  )
}
