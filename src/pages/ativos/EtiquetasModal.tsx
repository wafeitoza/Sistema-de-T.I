import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCheck, Printer, Search, X } from 'lucide-react'
import { Botao } from '../../components/ui/Botao'
import { EstadoVazio } from '../../components/ui/EstadoVazio'
import { conteudoQRAtivo, urlQRCode } from '../../lib/codes'
import type { Ativo } from '../../types'

export function EtiquetasModal({
  aberto,
  aoFechar,
  ativos,
}: {
  aberto: boolean
  aoFechar: () => void
  ativos: Ativo[]
}) {
  const [busca, setBusca] = useState('')
  const [selecionados, setSelecionados] = useState<string[]>([])

  const [abertoAnterior, setAbertoAnterior] = useState(aberto)
  if (aberto !== abertoAnterior) {
    setAbertoAnterior(aberto)
    if (aberto) {
      setBusca('')
      setSelecionados([])
    }
  }

  useEffect(() => {
    if (!aberto) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoFechar()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [aberto, aoFechar])

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return ativos
    return ativos.filter(
      (a) =>
        a.codigo.toLowerCase().includes(termo) ||
        a.descricao.toLowerCase().includes(termo) ||
        a.tombamento?.toLowerCase().includes(termo),
    )
  }, [ativos, busca])

  const etiquetas = useMemo(
    () => ativos.filter((a) => selecionados.includes(a.codigo)),
    [ativos, selecionados],
  )

  function alternar(codigo: string) {
    setSelecionados((atual) =>
      atual.includes(codigo) ? atual.filter((c) => c !== codigo) : [...atual, codigo],
    )
  }

  function marcarFiltrados() {
    setSelecionados((atual) => {
      const alvo = filtrados.map((a) => a.codigo)
      return Array.from(new Set([...atual, ...alvo]))
    })
  }

  function imprimir() {
    if (!etiquetas.length) return
    document.body.classList.add('imprimindo-etiquetas')
    window.print()
    document.body.classList.remove('imprimindo-etiquetas')
  }

  if (!aberto) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div
        className="anim-fade-in absolute inset-0 bg-black/50 backdrop-blur-sm etiqueta-overlay"
        onClick={aoFechar}
      />
      <div className="anim-scale-in etiqueta-caixa relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl bg-surface shadow-2xl">
        <div className="etiqueta-topo flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-base font-semibold text-content">
            Etiquetas com QR Code ({selecionados.length} selecionada{selecionados.length === 1 ? '' : 's'})
          </h2>
          <button
            onClick={aoFechar}
            className="rounded-lg p-1 text-content-muted transition-colors hover:bg-surface-2 hover:text-content"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="etiqueta-corpo flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="etiqueta-seletor space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-52 flex-1">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted"
                />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar ativo para etiqueta…"
                  className="h-9 w-full rounded-lg border border-line bg-surface pl-8 pr-3 text-sm text-content placeholder:text-content-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <Botao tamanho="sm" variante="secundario" onClick={marcarFiltrados}>
                <CheckCheck size={14} /> Marcar filtrados
              </Botao>
              <Botao
                tamanho="sm"
                variante="secundario"
                onClick={() => setSelecionados([])}
                disabled={!selecionados.length}
              >
                Limpar
              </Botao>
            </div>

            <ul className="max-h-44 overflow-y-auto rounded-lg border border-line divide-y divide-line">
              {filtrados.length === 0 && (
                <li className="px-3 py-4 text-center text-sm text-content-muted">
                  Nenhum ativo corresponde à busca.
                </li>
              )}
              {filtrados.map((a) => (
                <li key={a.codigo}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-surface-2">
                    <input
                      type="checkbox"
                      checked={selecionados.includes(a.codigo)}
                      onChange={() => alternar(a.codigo)}
                      className="h-4 w-4 accent-primary"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-content">
                        <span className="font-mono text-xs font-semibold">{a.codigo}</span> —{' '}
                        {a.descricao}
                      </span>
                      {a.tombamento || a.configuracao ? (
                        <span className="block truncate text-[11px] text-content-muted">
                          {[
                            a.tombamento && `Tombamento ${a.tombamento}`,
                            a.setor,
                            a.configuracao,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      ) : (
                        <span className="block text-[11px] text-content-muted">{a.setor}</span>
                      )}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>

          {etiquetas.length === 0 ? (
            <EstadoVazio
              titulo="Nenhuma etiqueta selecionada"
              mensagem="Marque os ativos acima para montar a folha de etiquetas."
            />
          ) : (
            <div className="folha-etiquetas grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-3">
              {etiquetas.map((a) => (
                <div
                  key={a.codigo}
                  className="flex items-start gap-2 rounded-lg border border-slate-300 bg-white p-2 text-slate-900"
                >
                  <img
                    src={urlQRCode(conteudoQRAtivo(a))}
                    alt={`QR ${a.codigo}`}
                    className="h-14 w-14 shrink-0"
                    loading="lazy"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs font-bold text-slate-900">{a.codigo}</p>
                    <p className="truncate text-[10px] leading-tight text-slate-700">
                      {a.descricao}
                    </p>
                    <p className="truncate text-[10px] leading-tight text-slate-700">
                      Setor: <span className="font-semibold">{a.setor}</span>
                    </p>
                    {a.tombamento && (
                      <p className="font-mono truncate text-[10px] leading-tight text-slate-700">
                        Tomb: {a.tombamento}
                      </p>
                    )}
                    {a.configuracao && (
                      <p className="truncate text-[10px] leading-tight text-slate-700">
                        Config: {a.configuracao}
                      </p>
                    )}
                    {(a.marca || a.modelo) && (
                      <p className="truncate text-[10px] leading-tight text-slate-700">
                        {a.marca}
                        {a.marca && a.modelo ? ' · ' : ''}
                        {a.modelo}
                      </p>
                    )}
                    <p className="truncate text-[10px] leading-tight text-slate-700">
                      Resp.: {a.responsavel}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="etiqueta-base flex items-center justify-between gap-2 border-t border-line px-5 py-4">
          <p className="text-xs text-content-muted">
            {etiquetas.length} etiqueta{etiquetas.length === 1 ? '' : 's'} na folha
          </p>
          <div className="flex gap-2">
            <Botao variante="secundario" onClick={aoFechar}>
              Fechar
            </Botao>
            <Botao onClick={imprimir} disabled={!etiquetas.length}>
              <Printer size={15} /> Imprimir
            </Botao>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
