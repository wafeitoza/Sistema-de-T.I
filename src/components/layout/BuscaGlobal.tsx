import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Boxes, Inbox, Package, Search, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { lerColecao } from '../../data/repository'
import { podeAcessarRota } from '../../lib/permissions'
import { ROTAS_NAVEGACAO } from '../../lib/rotas'
import { useAuthStore } from '../../store/auth'
import { useUiStore } from '../../store/ui'
import type { Ativo, ItemEstoque, Usuario } from '../../types'

interface Resultado {
  id: string
  grupo: string
  rotulo: string
  detalhe: string
  icone: LucideIcon
  aoExecutar: () => void
}

export function BuscaGlobal() {
  const navigate = useNavigate()
  const perfil = useAuthStore((s) => s.usuario?.perfil)
  const aberto = useUiStore((s) => s.buscaAberta)
  const fechar = useUiStore((s) => s.fecharBusca)
  const alternar = useUiStore((s) => s.alternarBusca)
  const [termo, setTermo] = useState('')
  const [selecionado, setSelecionado] = useState(0)
  const [abertoAnterior, setAbertoAnterior] = useState(aberto)
  const [termoAnterior, setTermoAnterior] = useState(termo)
  const listaRef = useRef<HTMLDivElement>(null)

  if (aberto !== abertoAnterior) {
    setAbertoAnterior(aberto)
    if (aberto) {
      setTermo('')
      setTermoAnterior('')
      setSelecionado(0)
    }
  }
  if (termo !== termoAnterior) {
    setTermoAnterior(termo)
    setSelecionado(0)
  }

  useEffect(() => {
    const atalho = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        alternar()
      }
    }
    document.addEventListener('keydown', atalho)
    return () => document.removeEventListener('keydown', atalho)
  }, [alternar])

  const resultados = useMemo(() => {
    const t = termo.trim().toLowerCase()
    const itens: Resultado[] = []

    for (const r of ROTAS_NAVEGACAO) {
      if (!podeAcessarRota(r.para, perfil ?? 'Visualizador')) continue
      if (t && !r.rotulo.toLowerCase().includes(t)) continue
      itens.push({
        id: `rota:${r.para}`,
        grupo: 'Navegação',
        rotulo: r.rotulo,
        detalhe: r.para,
        icone: r.icone,
        aoExecutar: () => navigate(r.para),
      })
    }

    if (t) {
      for (const a of lerColecao<Ativo>('ATIVOS')) {
        const alvo = `${a.codigo} ${a.descricao} ${a.tombamento ?? ''} ${a.serial ?? ''}`.toLowerCase()
        if (!alvo.includes(t)) continue
        itens.push({
          id: `ativo:${a.codigo}`,
          grupo: 'Ativos',
          rotulo: a.descricao,
          detalhe: `${a.codigo}${a.tombamento ? ` · tomb. ${a.tombamento}` : ''}`,
          icone: Boxes,
          aoExecutar: () => navigate(`/ativos?q=${encodeURIComponent(a.codigo)}`),
        })
        if (itens.filter((i) => i.grupo === 'Ativos').length >= 6) break
      }

      for (const i of lerColecao<ItemEstoque>('ESTOQUE')) {
        const alvo = `${i.codigo} ${i.descricao}`.toLowerCase()
        if (!alvo.includes(t)) continue
        itens.push({
          id: `estoque:${i.codigo}`,
          grupo: 'Estoque',
          rotulo: i.descricao,
          detalhe: `${i.codigo} · ${i.quantidade} ${i.unidade}`,
          icone: Package,
          aoExecutar: () => navigate('/estoque'),
        })
        if (itens.filter((i2) => i2.grupo === 'Estoque').length >= 5) break
      }

      if (perfil === 'Admin') {
        for (const u of lerColecao<Usuario>('USUARIOS')) {
          const alvo = `${u.nome} ${u.email}`.toLowerCase()
          if (!alvo.includes(t)) continue
          itens.push({
            id: `usuario:${u.email}`,
            grupo: 'Usuários',
            rotulo: u.nome,
            detalhe: `${u.email} · ${u.perfil}`,
            icone: Users,
            aoExecutar: () => navigate('/usuarios'),
          })
          if (itens.filter((i) => i.grupo === 'Usuários').length >= 5) break
        }
      }
    }

    return itens
  }, [termo, perfil, navigate])

  useEffect(() => {
    if (!aberto) return
    const el = listaRef.current?.querySelectorAll('[data-item]')[selecionado]
    el?.scrollIntoView({ block: 'nearest' })
  }, [selecionado, aberto])

  function executar(r: Resultado) {
    fechar()
    r.aoExecutar()
  }

  function aoTeclar(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      fechar()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelecionado((s) => Math.min(s + 1, Math.max(0, resultados.length - 1)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelecionado((s) => Math.max(s - 1, 0))
    } else if (e.key === 'Enter') {
      const r = resultados[selecionado]
      if (r) executar(r)
    }
  }

  if (!aberto) return null

  let indice = -1

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-[12vh]"
      onMouseDown={fechar}
      role="presentation"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-line bg-surface shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Busca global"
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search size={16} className="shrink-0 text-content-muted" />
          <input
            autoFocus
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            onKeyDown={aoTeclar}
            placeholder="Buscar páginas, ativos, itens…"
            className="h-12 flex-1 bg-transparent text-sm text-content outline-none placeholder:text-content-muted"
          />
          <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-content-muted">
            ESC
          </kbd>
        </div>

        <div ref={listaRef} className="max-h-72 overflow-y-auto py-2">
          {resultados.length ? (
            resultados.map((r) => {
              indice++
              const ativo = indice === selecionado
              const anterior = resultados[indice - 1]
              const novoGrupo = !anterior || anterior.grupo !== r.grupo
              return (
                <div key={r.id}>
                  {novoGrupo && (
                    <p className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-content-muted">
                      {r.grupo}
                    </p>
                  )}
                  <button
                    data-item
                    onMouseEnter={() => setSelecionado(indice)}
                    onClick={() => executar(r)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      ativo ? 'bg-primary/10' : ''
                    }`}
                  >
                    <r.icone
                      size={16}
                      className={ativo ? 'text-primary' : 'text-content-muted'}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-content">
                        {r.rotulo}
                      </span>
                      <span className="block truncate text-xs text-content-muted">
                        {r.detalhe}
                      </span>
                    </span>
                  </button>
                </div>
              )
            })
          ) : (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <Inbox size={22} className="text-content-muted" />
              <p className="text-sm font-medium text-content">
                Nenhum resultado para “{termo}”
              </p>
              <p className="text-xs text-content-muted">
                Tente outro termo ou navegue pelas páginas.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-line px-4 py-2 text-[11px] text-content-muted">
          <span>
            <kbd className="font-medium">↑↓</kbd> navegar
          </span>
          <span>
            <kbd className="font-medium">Enter</kbd> abrir
          </span>
          <span>
            <kbd className="font-medium">Esc</kbd> fechar
          </span>
          <span className="ml-auto">
            <kbd className="font-medium">Ctrl K</kbd> alternar
          </span>
        </div>
      </div>
    </div>
  )
}
