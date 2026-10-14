import { useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { FileSignature, Printer, ShieldCheck, X } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Botao } from '../../components/ui/Botao'
import { acharTermoDoEmprestimo, conteudoTermoEmprestimo, dadosTermoDeEmprestimo } from '../../lib/termos'
import { useTermosStore } from '../../store/termos'
import { useUiStore } from '../../store/ui'
import type { Ativo, Emprestimo, StatusTermo } from '../../types'

const TOM_STATUS: Record<StatusTermo, 'warning' | 'success' | 'neutral'> = {
  Pendente: 'warning',
  Assinado: 'success',
  Revogado: 'neutral',
}

/**
 * Mostra e imprime o termo de responsabilidade de um empréstimo.
 *
 * O texto é remontado a cada abertura a partir do empréstimo (não de um
 * registro salvo), então o que sai na impressão é sempre exatamente o que foi
 * hasheado — e o botão "Imprimir" funciona mesmo para empréstimos antigos.
 */
export function TermoEmprestimoModal({
  aberto,
  aoFechar,
  emprestimo,
  ativo,
}: {
  aberto: boolean
  aoFechar: () => void
  emprestimo: Emprestimo | null
  ativo: Ativo | undefined
}) {
  const termos = useTermosStore((s) => s.termos)
  const criar = useTermosStore((s) => s.criar)
  const notificar = useUiStore((s) => s.notificar)

  const dados = useMemo(
    () => (emprestimo ? dadosTermoDeEmprestimo(emprestimo, ativo) : null),
    [emprestimo, ativo],
  )
  const conteudo = useMemo(
    () => (dados ? conteudoTermoEmprestimo(dados) : ''),
    [dados],
  )
  const termo = useMemo(
    () => (emprestimo ? acharTermoDoEmprestimo(termos, emprestimo, ativo) : undefined),
    [termos, emprestimo, ativo],
  )

  useEffect(() => {
    if (!aberto) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoFechar()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [aberto, aoFechar])

  async function gerar() {
    if (!emprestimo || !dados) return
    try {
      const novo = await criar({
        ativoCodigo: emprestimo.codigoAtivo,
        responsavel: emprestimo.funcionario,
        conteudo,
      })
      notificar('sucesso', `${novo.id} criado com hash SHA-256 registrado.`)
    } catch {
      notificar('erro', 'Não foi possível calcular o hash do termo.')
    }
  }

  function imprimir() {
    document.body.classList.add('imprimindo-termo')
    window.print()
    document.body.classList.remove('imprimindo-termo')
  }

  if (!aberto || !emprestimo || !dados) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Termo de responsabilidade"
    >
      <div
        className="anim-fade-in absolute inset-0 bg-black/50 backdrop-blur-sm termo-overlay"
        onClick={aoFechar}
      />
      <div className="anim-scale-in termo-caixa relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-surface shadow-2xl">
        <div className="termo-topo flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-2">
            <FileSignature size={18} className="text-primary" />
            <h2 className="text-base font-semibold text-content">
              Termo de responsabilidade — {emprestimo.id}
            </h2>
          </div>
          <button
            onClick={aoFechar}
            className="rounded-lg p-1 text-content-muted transition-colors hover:bg-surface-2 hover:text-content"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="termo-corpo flex-1 overflow-y-auto px-5 py-4">
          <article className="folha-termo rounded-lg border border-line bg-white p-6 shadow-sm sm:p-9">
            <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-slate-900">
              {conteudo}
            </pre>
          </article>
        </div>

        <div className="termo-base flex flex-col gap-3 border-t border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1">
            {termo ? (
              <>
                <p className="flex items-center gap-2 text-xs text-content-muted">
                  <Badge tom={TOM_STATUS[termo.status]}>{termo.status}</Badge>
                  <span className="truncate">{termo.id}</span>
                </p>
                <code
                  className="block truncate font-mono text-[10px] text-content-muted"
                  title={termo.hash}
                >
                  SHA-256 {termo.hash ? `${termo.hash.slice(0, 24)}…` : '—'}
                </code>
              </>
            ) : (
              <p className="text-xs text-content-muted">
                Este empréstimo ainda não tem termo gerado. O registro fica em Termos de
                responsabilidade.
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!termo && (
              <Botao onClick={() => void gerar()}>
                <ShieldCheck size={15} /> Gerar termo
              </Botao>
            )}
            <Botao onClick={imprimir}>
              <Printer size={15} /> Imprimir / PDF
            </Botao>
            <Botao variante="secundario" onClick={aoFechar}>
              Fechar
            </Botao>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
